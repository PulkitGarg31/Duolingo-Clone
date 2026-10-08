"""Weekly leagues: the live board, joining on the week's first XP, finalization and the result modal.

The seeded learner competes in Silver this week (Monday 2026-10-05) with 42 XP against 29 bots, and
was promoted from Bronze last week; that result has not been acknowledged yet. A week ends on
Monday 00:00 UTC; Silver promotes the top 15 and demotes the bottom 7 of 30.
"""

from datetime import date

from fastapi.testclient import TestClient
from sqlalchemy import Engine, func, select
from sqlalchemy.orm import Session, selectinload

from app.core.clock import FrozenClock
from app.models import LeagueCohort, LeagueMembership
from tests.helpers import (
    API,
    Json,
    as_user,
    assert_problem,
    complete,
    get_me,
    node_at,
    play_lesson,
    play_session,
    start_session,
)

SILVER = {"tier": 2, "name": "Silver", "color": "#C9D6E2"}
BRONZE = {"tier": 1, "name": "Bronze", "color": "#D4A880"}


def board(client: TestClient, *, headers: dict[str, str] | None = None) -> Json:
    response = client.get(f"{API}/me/league", headers=headers)
    assert response.status_code == 200, response.text
    body: Json = response.json()
    return body


def next_week(client: TestClient) -> Json:
    response = client.post(f"{API}/dev/clock/next-week")
    assert response.status_code == 200, response.text
    body: Json = response.json()
    return body


def silver_zone(rank: int) -> str:
    return "promotion" if rank <= 15 else "demotion" if rank > 23 else "safe"


def test_the_board_ranks_all_thirty_members(client: TestClient) -> None:
    league = board(client)
    assert (league["unlocked"], league["lessonsToUnlock"], league["joined"], league["league"]) == (
        True,
        0,
        True,
        SILVER,
    )
    assert (league["weekStart"], league["weekEndsAt"], league["serverNow"]) == (
        "2026-10-05",
        "2026-10-12T00:00:00Z",
        "2026-10-08T12:00:00Z",
    )
    assert (league["promoteCount"], league["demoteCount"], league["cohortSize"]) == (15, 7, 30)
    rows = league["rows"]
    assert [row["rank"] for row in rows] == list(range(1, 31))
    assert [row["xp"] for row in rows] == sorted((row["xp"] for row in rows), reverse=True)
    assert [row["zone"] for row in rows] == [silver_zone(row["rank"]) for row in rows]
    (mine,) = [row for row in rows if row["isMe"]]
    assert (mine["displayName"], mine["xp"], mine["streak"]) == ("Alex", 42, 13)
    assert [tier["reached"] for tier in league["tiers"]] == [True, True] + [False] * 8
    assert [tier["name"] for tier in league["tiers"]][:3] == ["Bronze", "Silver", "Gold"]
    last_week = league["lastWeekResult"]
    assert (last_week["weekStart"], last_week["league"], last_week["outcome"], last_week["newLeague"]) == (
        "2026-09-28",
        BRONZE,
        "promoted",
        SILVER,
    )
    assert last_week["seen"] is False

    card = get_me(client)["league"]
    assert (card["rank"], card["zone"], card["weeklyXp"]) == (mine["rank"], mine["zone"], 42)
    above = rows[mine["rank"] - 2] if mine["rank"] > 1 else None
    assert card["xpToPassNext"] == (None if above is None else above["xp"] - 42 + 1)


def test_bots_climb_as_time_passes(client: TestClient, clock: FrozenClock) -> None:
    before = {row["userId"]: row["xp"] for row in board(client)["rows"] if not row["isMe"]}
    clock.advance(hours=24)  # Friday noon: the same league week
    after = {row["userId"]: row["xp"] for row in board(client)["rows"] if not row["isMe"]}
    assert after.keys() == before.keys()
    assert all(after[bot] >= before[bot] for bot in before)
    assert sum(after.values()) > sum(before.values())


def test_finishing_the_week_settles_every_members_place(
    client: TestClient, clock: FrozenClock, seeded_engine: Engine
) -> None:
    clock.advance(days=3, hours=11, minutes=59, seconds=59, microseconds=999_999)  # the week's last instant
    final_board = {row["userId"]: (row["rank"], row["xp"]) for row in board(client)["rows"]}

    jump = next_week(client)
    assert jump["clock"]["leagueWeekStart"] == "2026-10-12"
    (result,) = jump["effects"]["leagueResults"]
    assert (result["weekStart"], result["league"], result["finalXp"], result["seen"]) == (
        "2026-10-05",
        SILVER,
        42,
        False,
    )
    with Session(seeded_engine) as db:
        cohort = db.scalars(
            select(LeagueCohort)
            .where(LeagueCohort.week_start == date(2026, 10, 5))
            .options(selectinload(LeagueCohort.memberships))
        ).one()
        assert cohort.finalized_at is not None
        finals = {m.user_id: (m.final_rank, m.final_xp, m.outcome) for m in cohort.memberships}
    assert {
        user: (rank, xp) for user, (rank, xp, _) in finals.items()
    } == final_board  # the board as it ended
    for rank, xp, outcome in finals.values():
        promoted, demoted = rank is not None and rank <= 15 and xp is not None and xp > 0, (rank or 0) > 23
        assert outcome == ("promoted" if promoted else "demoted" if demoted else "stayed")

    new_tier = {"promoted": 3, "stayed": 2, "demoted": 1}[result["outcome"]]
    assert result["newLeague"]["tier"] == new_tier
    me = get_me(client)
    assert (me["league"]["tier"], me["pendingLeagueResult"]) == (new_tier, result)  # the newest result first


def test_the_first_xp_of_a_new_week_opens_a_cohort(client: TestClient, seeded_engine: Engine) -> None:
    next_week(client)
    card = get_me(client)["league"]
    assert (card["joinedThisWeek"], card["rank"], card["zone"], card["weeklyXp"], card["xpToPassNext"]) == (
        False,
        None,
        None,
        0,
        None,
    )
    empty = board(client)
    assert (empty["joined"], empty["rows"], empty["weekStart"]) == (False, [], "2026-10-12")

    receipt = play_lesson(client, seeded_engine, node_at(client, 2, 2))
    league = receipt["league"]
    assert (league["joinedNow"], league["rankBefore"], league["weeklyXp"]) == (
        True,
        None,
        receipt["xp"]["total"],
    )
    assert league["league"]["tier"] == receipt["me"]["league"]["tier"]
    rows = board(client)["rows"]
    assert len(rows) == 30 and sum(row["isMe"] for row in rows) == 1
    with Session(seeded_engine) as db:
        members = db.scalar(
            select(func.count())
            .select_from(LeagueMembership)
            .join(LeagueMembership.cohort)
            .where(LeagueCohort.week_start == date(2026, 10, 12))
        )
    assert members == 30  # the learner and 29 bots


def test_acknowledging_a_result_is_idempotent(client: TestClient, clock: FrozenClock) -> None:
    pending = get_me(client)["pendingLeagueResult"]
    first = client.post(f"{API}/me/league/results/{pending['membershipId']}/ack")
    assert first.status_code == 200
    assert first.json() == {"membershipId": pending["membershipId"], "seenAt": "2026-10-08T12:00:00Z"}
    clock.advance(minutes=5)
    again = client.post(f"{API}/me/league/results/{pending['membershipId']}/ack")
    assert again.json() == first.json()  # the first acknowledgement is kept
    assert get_me(client)["pendingLeagueResult"] is None
    assert board(client)["lastWeekResult"]["seen"] is True


def test_only_ones_own_finished_week_can_be_acknowledged(
    client: TestClient, seeded_engine: Engine, learner2: int
) -> None:
    alex = get_me(client)["user"]["id"]
    with Session(seeded_engine) as db:
        this_week = db.scalar(
            select(LeagueMembership.id)
            .join(LeagueMembership.cohort)
            .where(LeagueMembership.user_id == alex, LeagueCohort.finalized_at.is_(None))
        )
    assert_problem(client.post(f"{API}/me/league/results/{this_week}/ack"), 409, "LEAGUE_RESULT_NOT_READY")
    last_week = get_me(client)["pendingLeagueResult"]["membershipId"]
    theirs = as_user(learner2)
    assert_problem(client.post(f"{API}/me/league/results/{last_week}/ack", headers=theirs), 404, "NOT_FOUND")
    assert_problem(client.post(f"{API}/me/league/results/999999/ack"), 404, "NOT_FOUND")
    assert get_me(client)["pendingLeagueResult"]["seen"] is False


def test_weeks_without_xp_leave_the_tier_alone(client: TestClient) -> None:
    (result,) = next_week(client)["effects"]["leagueResults"]
    tier = result["newLeague"]["tier"]
    jump = client.post(f"{API}/dev/clock/advance", json={"days": 21}).json()
    assert jump["effects"]["leagueResults"] == []  # no XP, no membership: nothing to finalize
    card = get_me(client)["league"]
    assert (card["tier"], card["joinedThisWeek"]) == (tier, False)


def test_leagues_open_after_ten_completed_sessions(
    client: TestClient, clock: FrozenClock, seeded_engine: Engine, learner2: int
) -> None:
    theirs = as_user(learner2)
    card = get_me(client, headers=theirs)["league"]
    assert (card["unlocked"], card["lessonsToUnlock"], card["joinedThisWeek"]) == (False, 10, False)
    locked = board(client, headers=theirs)
    assert (locked["unlocked"], locked["joined"], locked["rows"], locked["lastWeekResult"]) == (
        False,
        False,
        [],
        None,
    )

    first = play_lesson(client, seeded_engine, node_at(client, 1, 1, headers=theirs), headers=theirs)
    assert first["league"] is None
    for _ in range(8):  # time-up timed runs are the quickest completed sessions: no answers, no XP
        run = start_session(client, {"kind": "timed"}, headers=theirs)
        clock.advance(seconds=31)
        assert complete(client, run["id"], headers=theirs)["league"] is None
    assert get_me(client, headers=theirs)["league"]["lessonsToUnlock"] == 1

    tenth = play_session(client, seeded_engine, {"kind": "practice"}, headers=theirs)
    league = tenth["league"]
    assert (league["joinedNow"], league["league"], league["rankBefore"]) == (True, BRONZE, None)
    opened = board(client, headers=theirs)
    assert (opened["unlocked"], opened["joined"], opened["league"], len(opened["rows"])) == (
        True,
        True,
        BRONZE,
        30,
    )
