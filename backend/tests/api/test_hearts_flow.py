"""Hearts in the lesson loop: running out blocks a lesson, a refill continues it, practice earns one back
and time regenerates them (one every 5 hours, keeping the unfinished part of the interval).

The seeded learner has 4 hearts; the running interval started an hour before the frozen instant
(12:00 UTC), so the next heart is due at 16:00.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine

from app.core.clock import FrozenClock
from tests.helpers import (
    API,
    Json,
    answer_for,
    answer_items,
    assert_problem,
    buy,
    complete,
    get_me,
    load_exercises,
    node_at,
    play_session,
    set_learner,
    start_session,
    submit,
)


def miss_the_first_item(client: TestClient, engine: Engine, session: Json) -> Json:
    """Answer the session's first item wrongly; returns the answer's result."""
    first = session["items"][0]
    exercise = load_exercises(engine, [first["exercise"]["id"]])[first["exercise"]["id"]]
    response = submit(client, session["id"], first["id"], answer_for(exercise, correct=False))
    assert response.status_code == 200, response.text
    result: Json = response.json()
    return result


@pytest.fixture
def blocked_lesson(client: TestClient, seeded_engine: Engine) -> Json:
    """Lesson 2 of "Drinks", blocked: the learner had one heart left and lost it on the first item."""
    set_learner(client, hearts=1)  # the interval restarts now, at 12:00
    session = start_session(client, {"kind": "lesson", "nodeId": node_at(client, 2, 2)})
    result = miss_the_first_item(client, seeded_engine, session)
    assert (result["heartLost"], result["hearts"]["current"]) == (True, 0)
    return session


def test_losing_the_last_heart_blocks_the_lesson(client: TestClient, blocked_lesson: Json) -> None:
    read = client.get(f"{API}/sessions/{blocked_lesson['id']}").json()
    assert (read["status"], read["blockedReason"], read["canComplete"]) == ("active", "OUT_OF_HEARTS", False)
    assert (read["hearts"]["current"], read["hearts"]["nextHeartAt"]) == (0, "2026-10-08T17:00:00Z")
    assert get_me(client)["activeSession"]["id"] == blocked_lesson["id"]


def test_a_blocked_lesson_takes_no_answers_and_cannot_complete(
    client: TestClient, blocked_lesson: Json
) -> None:
    second = blocked_lesson["items"][1]
    problem = assert_problem(
        submit(client, blocked_lesson["id"], second["id"], {"type": "skip"}), 409, "OUT_OF_HEARTS"
    )
    assert problem["nextHeartAt"] == "2026-10-08T17:00:00Z"
    problem = assert_problem(
        client.post(f"{API}/sessions/{blocked_lesson['id']}/complete"), 409, "OUT_OF_HEARTS"
    )
    assert problem["nextHeartAt"] == "2026-10-08T17:00:00Z"


def test_a_refill_continues_the_blocked_lesson_to_the_end(
    client: TestClient, seeded_engine: Engine, blocked_lesson: Json
) -> None:
    purchase = buy(client, "heart_refill")
    assert purchase.status_code == 201
    refilled = purchase.json()["effect"]["hearts"]
    assert (refilled["current"], refilled["nextHeartAt"]) == (5, None)
    read = client.get(f"{API}/sessions/{blocked_lesson['id']}").json()
    assert (read["status"], read["blockedReason"]) == ("active", None)
    results = answer_items(client, seeded_engine, read)
    assert results[-1]["session"]["canComplete"] is True
    receipt = complete(client, blocked_lesson["id"])
    assert receipt["stats"]["mistakes"] == 1
    assert receipt["me"]["hearts"]["current"] == 5


def test_quitting_a_blocked_lesson_fails_it_as_out_of_hearts(
    client: TestClient, blocked_lesson: Json
) -> None:
    quit_ = client.post(f"{API}/sessions/{blocked_lesson['id']}/quit").json()
    assert (quit_["status"], quit_["endReason"], quit_["replayed"]) == ("failed", "out_of_hearts", False)
    assert quit_["hearts"]["current"] == 0  # hearts already lost stay lost


def test_regenerating_a_heart_unblocks_the_lesson(
    client: TestClient, clock: FrozenClock, seeded_engine: Engine
) -> None:
    clock.advance(hours=2, minutes=30)  # 14:30; the interval that started at 11:00 is still running
    session = start_session(client, {"kind": "lesson", "nodeId": node_at(client, 2, 2)})
    results = answer_items(client, seeded_engine, session, wrong={1, 2, 3, 4}, limit=4)
    assert [result["hearts"]["current"] for result in results] == [3, 2, 1, 0]
    assert results[-1]["session"]["blockedReason"] == "OUT_OF_HEARTS"

    clock.advance(hours=1, minutes=30)  # 16:00: a heart is back, well within the two-hour idle limit
    read = client.get(f"{API}/sessions/{session['id']}").json()
    assert (read["status"], read["hearts"]["current"], read["blockedReason"]) == ("active", 1, None)
    fifth = session["items"][4]
    assert submit(client, session["id"], fifth["id"], {"type": "skip"}).status_code == 200


def test_a_blocked_lesson_left_alone_still_expires(
    client: TestClient, clock: FrozenClock, blocked_lesson: Json
) -> None:
    clock.advance(hours=5)  # a heart is back, but the lesson was idle for more than two hours
    read = client.get(f"{API}/sessions/{blocked_lesson['id']}").json()
    assert (read["status"], read["endReason"], read["blockedReason"]) == ("abandoned", "idle_timeout", None)
    assert read["hearts"]["current"] == 1


def test_a_lesson_cannot_start_without_a_heart(client: TestClient) -> None:
    set_learner(client, hearts=0)
    response = client.post(f"{API}/sessions", json={"kind": "lesson", "nodeId": node_at(client, 2, 2)})
    problem = assert_problem(response, 409, "OUT_OF_HEARTS")
    assert problem["nextHeartAt"] == "2026-10-08T17:00:00Z"
    assert get_me(client)["activeSession"] is None


def test_practice_is_open_at_zero_hearts_and_earns_one_back(
    client: TestClient, seeded_engine: Engine
) -> None:
    set_learner(client, hearts=0)
    receipt = play_session(client, seeded_engine, {"kind": "practice"}, wrong={1})
    assert receipt["heartsGained"] == 1
    hearts = receipt["me"]["hearts"]
    assert (hearts["current"], hearts["nextHeartAt"]) == (
        1,
        "2026-10-08T17:00:00Z",
    )  # the interval keeps running


def test_hearts_come_back_one_every_five_hours(client: TestClient, clock: FrozenClock) -> None:
    set_learner(client, hearts=0)  # the interval starts at 12:00
    clock.advance(hours=4, minutes=59, seconds=59)
    assert get_me(client)["hearts"]["current"] == 0
    clock.advance(seconds=1)
    hearts = get_me(client)["hearts"]
    assert (hearts["current"], hearts["nextHeartAt"], hearts["fullAt"]) == (
        1,
        "2026-10-08T22:00:00Z",
        "2026-10-09T13:00:00Z",
    )
    clock.advance(hours=17)  # 10:00 the next day: three more intervals ended, the fourth runs on
    hearts = get_me(client)["hearts"]
    assert (hearts["current"], hearts["nextHeartAt"]) == (4, "2026-10-09T13:00:00Z")
    clock.advance(hours=3)
    hearts = get_me(client)["hearts"]
    assert (hearts["current"], hearts["nextHeartAt"], hearts["fullAt"]) == (5, None, None)


def test_mistakes_outside_lessons_cost_no_heart(client: TestClient, seeded_engine: Engine) -> None:
    practice = start_session(client, {"kind": "practice"})
    result = miss_the_first_item(client, seeded_engine, practice)
    assert (result["heartLost"], result["hearts"]["current"]) == (False, 4)
    assert practice["rules"] == {
        "heartsEnabled": False,
        "retryPolicy": "once",
        "hintsEnabled": True,
        "maxMistakes": None,
    }
