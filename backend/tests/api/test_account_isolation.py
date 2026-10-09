"""Every account is a sandbox: its own simulated clock, its own league cohorts, its own reset.

Two accounts, A and B, sign up next to the seeded demo learner (who is served without a token). One
learner's demo tools never move another learner's clock, board or data.
"""

from datetime import date

from fastapi.testclient import TestClient
from sqlalchemy import Engine, func, select
from sqlalchemy.orm import Session

from app.core.clock import FrozenClock
from app.models import BotProfile, LeagueCohort, LessonSession, XpEvent
from tests.helpers import (
    API,
    Json,
    bearer,
    complete,
    get_me,
    node_at,
    play_lesson,
    play_session,
    signup,
    start_session,
)


def accounts(client: TestClient) -> tuple[dict[str, str], dict[str, str]]:
    """The request headers of two new accounts, A and B."""
    a = signup(client, "ana@example.com", display_name="Ana")
    b = signup(client, "bea@example.com", display_name="Bea")
    return bearer(a["token"]), bearer(b["token"])


def clock_of(client: TestClient, headers: dict[str, str] | None = None) -> Json:
    response = client.get(f"{API}/dev/clock", headers=headers)
    assert response.status_code == 200, response.text
    body: Json = response.json()
    return body


def unlock_leagues(client: TestClient, engine: Engine, clock: FrozenClock, headers: dict[str, str]) -> Json:
    """Complete ten sessions, the quickest way: a lesson, eight timed runs left to time out, then a
    practice whose XP joins this week's league. Returns the tenth receipt."""
    play_lesson(client, engine, node_at(client, 1, 1, headers=headers), headers=headers)
    for _ in range(8):
        run = start_session(client, {"kind": "timed"}, headers=headers)
        clock.advance(seconds=31)
        complete(client, run["id"], headers=headers)
    return play_session(client, engine, {"kind": "practice"}, headers=headers)


# ---- the clock ----


def test_one_accounts_time_travel_moves_no_one_elses_clock(client: TestClient) -> None:
    a, b = accounts(client)
    jump = client.post(f"{API}/dev/clock/advance", json={"days": 2, "hours": 3}, headers=a)
    assert jump.status_code == 200, jump.text
    assert jump.headers["x-server-time"] == "2026-10-10T15:00:00Z"

    assert (clock_of(client, a)["offsetSeconds"], get_me(client, headers=a)["serverNow"]) == (
        2 * 86_400 + 3 * 3600,
        "2026-10-10T15:00:00Z",
    )
    for other in (b, None):  # B, and the demo learner served without a token
        other_clock = clock_of(client, other)
        assert (other_clock["offsetSeconds"], other_clock["now"]) == (0, "2026-10-08T12:00:00Z")
        me = get_me(client, headers=other)
        assert (me["serverNow"], me["dev"]["clockOffsetSeconds"]) == ("2026-10-08T12:00:00Z", 0)
    assert get_me(client)["streak"]["current"] == 13  # the demo's streak didn't see A's missed days


def test_the_demo_learners_time_travel_moves_no_account(client: TestClient) -> None:
    a, _ = accounts(client)
    assert client.post(f"{API}/dev/clock/next-week").status_code == 200
    assert get_me(client)["serverNow"] == "2026-10-12T00:00:05Z"
    assert get_me(client, headers=a)["serverNow"] == "2026-10-08T12:00:00Z"


def test_real_time_still_moves_everyone(client: TestClient, clock: FrozenClock) -> None:
    a, b = accounts(client)
    client.post(f"{API}/dev/clock/advance", json={"hours": 1}, headers=a)
    clock.advance(minutes=30)
    assert get_me(client, headers=a)["serverNow"] == "2026-10-08T13:30:00Z"
    assert get_me(client, headers=b)["serverNow"] == "2026-10-08T12:30:00Z"


# ---- the reset ----


def test_one_accounts_reset_leaves_the_others_untouched(client: TestClient, seeded_engine: Engine) -> None:
    a, b = accounts(client)
    b_receipt = play_lesson(client, seeded_engine, node_at(client, 1, 1, headers=b), headers=b)
    play_lesson(client, seeded_engine, node_at(client, 1, 1, headers=a), headers=a)
    client.post(f"{API}/dev/clock/advance", json={"hours": 2}, headers=a)
    b_before, demo_before = get_me(client, headers=b), get_me(client)

    reset = client.post(f"{API}/dev/reset", headers=a)
    assert reset.status_code == 200, reset.text
    a_after = reset.json()["me"]
    assert (a_after["xp"]["total"], a_after["gems"], a_after["dev"]["clockOffsetSeconds"]) == (0, 500, 0)
    assert a_after["user"]["email"] == "ana@example.com"  # still signed in as A

    b_after = get_me(client, headers=b)
    assert (b_after["xp"], b_after["gems"], b_after["streak"]) == (
        b_before["xp"],
        b_before["gems"],
        b_before["streak"],
    )
    assert b_after["xp"]["total"] == b_receipt["xp"]["total"] > 0
    with Session(seeded_engine) as db:
        b_id = b_after["user"]["id"]
        sessions = db.scalar(
            select(func.count()).select_from(LessonSession).where(LessonSession.user_id == b_id)
        )
        xp_rows = db.scalar(select(func.count()).select_from(XpEvent).where(XpEvent.user_id == b_id))
    assert (sessions, xp_rows) == (1, len(b_receipt["xp"]["lines"]))
    demo_after = get_me(client)
    assert (demo_after["xp"], demo_after["gems"]) == (demo_before["xp"], demo_before["gems"])


def test_a_reset_keeps_the_account_signed_in(client: TestClient) -> None:
    a, _ = accounts(client)
    assert client.post(f"{API}/dev/reset", headers=a).status_code == 200
    assert get_me(client, headers=a)["user"]["email"] == "ana@example.com"


# ---- leagues ----


def test_an_account_and_the_demo_learner_compete_in_separate_cohorts(
    client: TestClient, clock: FrozenClock, seeded_engine: Engine
) -> None:
    a, _ = accounts(client)
    tenth = unlock_leagues(client, seeded_engine, clock, a)
    assert tenth["league"]["joinedNow"] is True

    a_board = client.get(f"{API}/me/league", headers=a).json()
    demo_board = client.get(f"{API}/me/league").json()
    a_id, demo_id = get_me(client, headers=a)["user"]["id"], get_me(client)["user"]["id"]
    a_members = {row["userId"] for row in a_board["rows"]}
    demo_members = {row["userId"] for row in demo_board["rows"]}
    assert (len(a_members), len(demo_members)) == (30, 30)
    assert a_id in a_members and demo_id not in a_members
    assert demo_id in demo_members and a_id not in demo_members
    assert [row["isMe"] for row in a_board["rows"]].count(True) == 1
    with Session(seeded_engine) as db:
        bots = set(db.scalars(select(BotProfile.user_id)))
        this_week = db.execute(
            select(LeagueCohort.owner_user_id, LeagueCohort.league_tier).where(
                LeagueCohort.week_start == date(2026, 10, 5)
            )
        ).all()
    assert sorted(tuple(row) for row in this_week) == sorted([(demo_id, 2), (a_id, 1)])
    assert a_members - {a_id} <= bots  # A's rivals are bots drawn for A


def test_ending_one_learners_week_finalizes_only_their_cohort(
    client: TestClient, clock: FrozenClock, seeded_engine: Engine
) -> None:
    a, _ = accounts(client)
    unlock_leagues(client, seeded_engine, clock, a)
    a_id = get_me(client, headers=a)["user"]["id"]

    jump = client.post(f"{API}/dev/clock/next-week", headers=a)
    (result,) = jump.json()["effects"]["leagueResults"]
    assert (result["weekStart"], result["league"]["name"]) == ("2026-10-05", "Bronze")
    with Session(seeded_engine) as db:
        finalized = dict(
            db.execute(
                select(LeagueCohort.owner_user_id, LeagueCohort.finalized_at).where(
                    LeagueCohort.week_start == date(2026, 10, 5)
                )
            ).all()
        )
    assert finalized.pop(a_id) is not None
    assert list(finalized.values()) == [None]  # the demo learner's Silver week is still running
    demo = get_me(client)
    assert (demo["league"]["joinedThisWeek"], demo["league"]["weekEndsAt"]) == (True, "2026-10-12T00:00:00Z")


def test_a_bot_profile_counts_the_viewers_cohorts_only(client: TestClient, seeded_engine: Engine) -> None:
    a, _ = accounts(client)
    bot_id = next(row["userId"] for row in client.get(f"{API}/me/league").json()["rows"] if not row["isMe"])
    with Session(seeded_engine) as db:
        baseline = db.scalars(select(BotProfile.baseline_xp).where(BotProfile.user_id == bot_id)).one()
    demo_view = client.get(f"{API}/users/{bot_id}/profile").json()["stats"]
    a_view = client.get(f"{API}/users/{bot_id}/profile", headers=a).json()["stats"]
    assert demo_view["totalXp"] > baseline  # its weeks in the demo learner's cohorts count
    assert demo_view["league"] is not None
    assert (a_view["totalXp"], a_view["league"]) == (baseline, None)  # A has never met this bot
