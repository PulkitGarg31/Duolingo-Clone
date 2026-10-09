"""The learner's clock: simulated time is real time plus the learner's own forward-only offset, and
every jump catches the learner up exactly as a request would (hearts, streak freezes or loss, league
weeks, idle sessions). Other learners keep their own clocks (see test_account_isolation.py).

At the frozen instant it is Thursday 2026-10-08, 17:30 in Kolkata. The seeded streak (13 days) last
covered yesterday, with one Streak Freeze equipped.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, select
from sqlalchemy.orm import Session

from app.domain.enums import GemReason
from app.models import GemTransaction, User
from tests.helpers import (
    API,
    Json,
    assert_problem,
    get_me,
    node_at,
    play_lesson,
    set_learner,
    start_session,
    use_settings,
)

DEV_ROUTES = {
    ("GET", "/api/v1/dev/clock"),
    ("POST", "/api/v1/dev/clock/advance"),
    ("POST", "/api/v1/dev/clock/next-day"),
    ("POST", "/api/v1/dev/clock/next-week"),
    ("PATCH", "/api/v1/dev/learner"),
    ("POST", "/api/v1/dev/reset"),
}


def jump(client: TestClient, path: str, body: Json | None = None) -> Json:
    response = client.post(f"{API}/dev/clock/{path}", json=body)
    assert response.status_code == 200, response.text
    assert response.headers["x-server-time"] == response.json()["clock"]["now"]  # the new instant
    change: Json = response.json()
    return change


def offset(engine: Engine, username: str = "alex") -> int:
    """How far the learner's own clock runs ahead of real time, as stored."""
    with Session(engine) as db:
        return db.scalars(select(User.clock_offset_seconds).where(User.username == username)).one()


def day_states(client: TestClient) -> dict[str, str]:
    return {day["date"]: day["state"] for day in client.get(f"{API}/me/activity").json()["items"]}


def test_the_clock_shows_real_and_simulated_time(client: TestClient) -> None:
    response = client.get(f"{API}/dev/clock")
    assert response.status_code == 200
    assert response.json() == {
        "realNow": "2026-10-08T12:00:00Z",
        "offsetSeconds": 0,
        "now": "2026-10-08T12:00:00Z",
        "timezone": "Asia/Kolkata",
        "localNow": "2026-10-08T17:30:00+05:30",
        "localDate": "2026-10-08",
        "leagueWeekStart": "2026-10-05",
        "leagueWeekEndsAt": "2026-10-12T00:00:00Z",
    }


@pytest.mark.parametrize(
    "body", [{}, {"minutes": 0}, {"days": 61}, {"days": 60, "minutes": 1}, {"hours": -1}, {"weeks": 1}]
)
def test_a_jump_must_be_one_minute_to_sixty_days(
    client: TestClient, seeded_engine: Engine, body: Json
) -> None:
    assert_problem(client.post(f"{API}/dev/clock/advance", json=body), 422, "VALIDATION_ERROR")
    assert offset(seeded_engine) == 0


def test_advancing_moves_the_offset_and_regenerates_hearts(client: TestClient, seeded_engine: Engine) -> None:
    change = jump(client, "advance", {"hours": 5})
    assert (change["clock"]["offsetSeconds"], change["clock"]["now"], change["clock"]["realNow"]) == (
        18000,
        "2026-10-08T17:00:00Z",
        "2026-10-08T12:00:00Z",
    )
    assert change["effects"] == {
        "heartsGained": 1,  # the interval that started at 11:00 ended at 16:00
        "streak": {"before": 13, "after": 13, "freezesUsed": 0, "lost": False},
        "leagueResults": [],
        "sessionsExpired": 0,
    }
    assert offset(seeded_engine) == 18000
    assert get_me(client)["serverNow"] == "2026-10-08T17:00:00Z"


def test_the_next_day_puts_the_streak_at_risk_again(client: TestClient, seeded_engine: Engine) -> None:
    play_lesson(client, seeded_engine, node_at(client, 2, 2))
    assert get_me(client)["streak"]["status"] == "extended"

    change = jump(client, "next-day")
    assert (change["clock"]["now"], change["clock"]["localDate"]) == ("2026-10-08T18:30:05Z", "2026-10-09")
    assert change["effects"]["streak"] == {"before": 14, "after": 14, "freezesUsed": 0, "lost": False}
    me = get_me(client)
    assert (me["streak"]["current"], me["streak"]["status"], me["streak"]["extendedToday"]) == (
        14,
        "at_risk",
        False,
    )
    assert (me["localDate"], me["xp"]["today"], me["dailyGoal"]["earnedXp"]) == ("2026-10-09", 0, 0)
    goal = client.get(f"{API}/me/quests").json()["quests"][0]
    assert (goal["progress"], goal["completed"]) == (0, False)


def test_a_freeze_covers_the_day_missed_after_a_lesson(client: TestClient, seeded_engine: Engine) -> None:
    play_lesson(client, seeded_engine, node_at(client, 2, 2))  # the streak reaches 14 today
    change = jump(client, "advance", {"days": 2})
    assert change["effects"] == {
        "heartsGained": 1,
        "streak": {"before": 14, "after": 14, "freezesUsed": 1, "lost": False},
        "leagueResults": [],
        "sessionsExpired": 0,
    }
    me = get_me(client)
    assert (me["streak"]["freezesEquipped"], me["streak"]["frozenYesterday"], me["streak"]["status"]) == (
        0,
        True,
        "at_risk",
    )
    assert day_states(client)["2026-10-09"] == "frozen"


def test_two_missed_days_use_the_freeze_and_still_lose_the_streak(client: TestClient) -> None:
    change = jump(client, "advance", {"days": 2})  # today was not done, so the 8th and the 9th are missed
    assert change["effects"]["streak"] == {"before": 13, "after": 0, "freezesUsed": 1, "lost": True}
    streak = get_me(client)["streak"]
    assert (streak["current"], streak["longest"], streak["status"], streak["freezesEquipped"]) == (
        0,
        13,
        "inactive",
        0,
    )
    states = day_states(client)
    assert (states["2026-10-08"], states["2026-10-09"]) == ("frozen", "none")


def test_without_a_freeze_one_missed_day_loses_the_streak(client: TestClient) -> None:
    covered = jump(client, "next-day")  # the 8th is missed; the equipped freeze covers it
    assert covered["effects"]["streak"] == {"before": 13, "after": 13, "freezesUsed": 1, "lost": False}
    lost = jump(client, "next-day")  # the 9th is missed too, and no freeze is left
    assert lost["effects"]["streak"] == {"before": 13, "after": 0, "freezesUsed": 0, "lost": True}
    assert get_me(client)["streak"]["status"] == "inactive"


def test_the_next_week_starts_just_after_monday_midnight(client: TestClient) -> None:
    change = jump(client, "next-week")
    clock = change["clock"]
    assert (clock["now"], clock["leagueWeekStart"], clock["leagueWeekEndsAt"]) == (
        "2026-10-12T00:00:05Z",
        "2026-10-12",
        "2026-10-19T00:00:00Z",
    )
    assert len(change["effects"]["leagueResults"]) == 1  # the learner's Silver week


def test_a_session_idle_through_a_jump_expires(client: TestClient) -> None:
    session = start_session(client, {"kind": "lesson", "nodeId": node_at(client, 2, 2)})
    change = jump(client, "advance", {"hours": 3})
    assert change["effects"]["sessionsExpired"] == 1
    assert client.get(f"{API}/sessions/{session['id']}").json()["endReason"] == "idle_timeout"


def test_the_clock_only_ever_moves_forward(client: TestClient, seeded_engine: Engine) -> None:
    offsets = [offset(seeded_engine)]
    jump(client, "advance", {"minutes": 1})
    offsets.append(offset(seeded_engine))
    jump(client, "next-day")
    offsets.append(offset(seeded_engine))
    jump(client, "next-week")
    offsets.append(offset(seeded_engine))
    assert offsets == sorted(set(offsets))  # strictly increasing
    # Besides these jumps, the learner's reset is the only way back to real time: nothing sets the offset.
    paths = client.get(f"{API}/openapi.json").json()["paths"]
    routes = {(method.upper(), path) for path, item in paths.items() for method in item if "/dev/" in path}
    assert routes == DEV_ROUTES


def test_the_learner_patch_moves_gems_through_the_ledger(client: TestClient, seeded_engine: Engine) -> None:
    me = set_learner(client, hearts=0, gems=1320)
    assert (me["gems"], me["hearts"]["current"], me["hearts"]["nextHeartAt"]) == (
        1320,
        0,
        "2026-10-08T17:00:00Z",
    )
    with Session(seeded_engine) as db:
        last = db.scalars(select(GemTransaction).order_by(GemTransaction.id.desc()).limit(1)).one()
    assert (last.reason, last.delta, last.balance_after) == (GemReason.DEV, 500, 1320)
    full = set_learner(client, hearts=5)
    assert (full["hearts"]["current"], full["hearts"]["nextHeartAt"], full["gems"]) == (5, None, 1320)
    assert_problem(client.patch(f"{API}/dev/learner", json={}), 422, "VALIDATION_ERROR")
    assert_problem(client.patch(f"{API}/dev/learner", json={"hearts": 6}), 422, "VALIDATION_ERROR")


def test_switched_off_dev_tools_answer_403(client: TestClient) -> None:
    use_settings(client, enable_dev_tools=False)
    for method, path in sorted(DEV_ROUTES):
        response = client.request(method, path, json={"hours": 1} if method != "GET" else None)
        assert_problem(response, 403, "DEV_TOOLS_DISABLED")
    assert get_me(client)["dev"] is None
