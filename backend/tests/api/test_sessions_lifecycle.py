"""A session's life: start or resume, supersede, read back, expire, complete exactly once, quit.

The seeded learner's active node is "Drinks" (unit 2, position 2); "Introduce yourself" (unit 1,
position 2) is completed, so it can be practised.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, func, select
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import set_committed_value

from app.core.clock import FrozenClock
from app.domain.enums import SessionStatus
from app.models import LessonSession, XpEvent
from app.repositories import play_repo
from tests.helpers import (
    API,
    Json,
    answer_items,
    as_user,
    assert_problem,
    complete,
    get_me,
    node_at,
    start_session,
)

DRINKS = (2, 2)
INTRODUCE_YOURSELF = (1, 2)


def lesson_on(client: TestClient, place: tuple[int, int]) -> Json:
    return {"kind": "lesson", "nodeId": node_at(client, *place)}


def xp_lines_of(engine: Engine, session_id: int) -> int:
    with Session(engine) as db:
        return (
            db.scalar(select(func.count()).select_from(XpEvent).where(XpEvent.session_id == session_id)) or 0
        )


# ---- starting ----


def test_a_new_session_is_created_and_located(client: TestClient) -> None:
    response = client.post(f"{API}/sessions", json=lesson_on(client, DRINKS))
    session = response.json()
    assert response.status_code == 201
    assert response.headers["location"] == f"{API}/sessions/{session['id']}"
    assert (session["kind"], session["status"], session["endReason"], session["resumed"]) == (
        "lesson",
        "active",
        None,
        False,
    )
    assert session["lesson"] == {"id": session["lesson"]["id"], "number": 2, "count": 3}
    assert session["currentItemId"] == session["items"][0]["id"]
    assert get_me(client)["activeSession"] == {
        "id": session["id"],
        "kind": "lesson",
        "nodeId": session["node"]["id"],
    }


def test_starting_the_same_kind_and_node_again_resumes_the_session(client: TestClient) -> None:
    first = start_session(client, lesson_on(client, DRINKS))
    response = client.post(f"{API}/sessions", json=lesson_on(client, DRINKS))
    again = response.json()
    assert response.status_code == 200
    assert "location" not in response.headers
    assert (again["id"], again["resumed"]) == (first["id"], True)
    assert again["items"] == first["items"]


def test_starting_another_node_supersedes_the_active_session(client: TestClient) -> None:
    lesson = start_session(client, lesson_on(client, DRINKS))
    practice = start_session(client, {"kind": "practice", "nodeId": node_at(client, *INTRODUCE_YOURSELF)})
    assert practice["id"] != lesson["id"]
    ended = client.get(f"{API}/sessions/{lesson['id']}").json()
    assert (ended["status"], ended["endReason"], ended["currentItemId"]) == (
        "abandoned",
        "superseded",
        lesson["items"][0]["id"],
    )
    assert ended["canComplete"] is False
    assert get_me(client)["activeSession"]["id"] == practice["id"]


def test_a_refused_start_leaves_the_active_session_untouched(client: TestClient) -> None:
    lesson = start_session(client, lesson_on(client, DRINKS))
    family = node_at(client, 3, 1)
    assert_problem(
        client.post(f"{API}/sessions", json={"kind": "lesson", "nodeId": family}), 409, "NODE_LOCKED"
    )
    drinks = lesson["node"]["id"]
    assert_problem(
        client.post(f"{API}/sessions", json={"kind": "legendary", "nodeId": drinks}), 409, "NODE_NOT_PLAYABLE"
    )
    assert_problem(
        client.post(f"{API}/sessions", json={"kind": "lesson", "nodeId": 999_999}), 404, "NOT_FOUND"
    )
    assert client.get(f"{API}/sessions/{lesson['id']}").json()["status"] == "active"
    assert get_me(client)["activeSession"]["id"] == lesson["id"]


@pytest.mark.parametrize(
    ("body", "field"),
    [
        ({"kind": "lesson"}, "body"),
        ({"kind": "legendary"}, "body"),
        ({"kind": "timed", "nodeId": 2}, "body"),
        ({"kind": "review", "nodeId": 2}, "body.kind"),
    ],
)
def test_a_start_request_must_name_a_node_exactly_when_its_kind_needs_one(
    client: TestClient, body: Json, field: str
) -> None:
    problem = assert_problem(client.post(f"{API}/sessions", json=body), 422, "VALIDATION_ERROR")
    assert problem["errors"][0]["field"] == field


# ---- reading ----


def test_a_session_reads_back_identically_every_time(client: TestClient, clock: FrozenClock) -> None:
    started = start_session(client, lesson_on(client, DRINKS))
    read = client.get(f"{API}/sessions/{started['id']}").json()
    assert read == started  # same queue, same shuffled options and pairs, same state
    clock.advance(minutes=10)
    later = client.get(f"{API}/sessions/{started['id']}").json()
    assert later["items"] == started["items"]
    assert later["serverNow"] == "2026-10-08T12:10:00Z"


def test_prompts_carry_word_hints_in_the_learned_language_only(client: TestClient) -> None:
    items = start_session(client, lesson_on(client, DRINKS))["items"]
    picture_choice, spanish, english, listening = items[0], items[1], items[4], items[5]
    assert (picture_choice["label"], picture_choice["exercise"]["prompt"]) == ("new_word", None)
    assert all(item["label"] is None for item in items[1:])

    prompt = spanish["exercise"]["prompt"]  # "Yo bebo agua." to English
    assert "".join(segment["text"] for segment in prompt["segments"]) == prompt["text"] == "Yo bebo agua."
    assert {segment["text"]: segment["hint"] for segment in prompt["segments"]}["bebo"] == "drink, I drink"
    assert (prompt["language"], prompt["speak"], spanish["exercise"]["specialCharacters"]) == ("es", True, [])

    prompt = english["exercise"]["prompt"]  # "I want a juice, please." to Spanish
    assert prompt["segments"] == [{"text": "I want a juice, please.", "hint": None}]
    assert (prompt["speak"], english["exercise"]["answerLanguage"]) == (False, "es")
    assert english["exercise"]["specialCharacters"] == ["á", "é", "í", "ó", "ú", "ñ", "ü", "¿", "¡"]

    exercise = listening["exercise"]  # the sentence is spoken, never shown
    assert (exercise["audioOnly"], exercise["prompt"]["speak"], exercise["prompt"]["segments"]) == (
        True,
        True,
        [],
    )


def test_each_exercise_type_is_sent_without_its_answer(client: TestClient) -> None:
    items = start_session(client, lesson_on(client, DRINKS))["items"]
    choice, sentence, match, blank = (item["exercise"] for item in items[:4])
    assert (choice["layout"], choice["prompt"]) == ("pictures", None)  # "Which one of these is 'the juice'?"
    assert {option["text"] for option in choice["options"]} == {"el jugo", "el agua", "la leche"}
    assert all(option["imageKey"] for option in choice["options"])
    assert {"I", "drink", "water"} <= {tile["text"] for tile in sentence["tiles"]}  # plus distractors
    assert {token["id"] for token in match["left"]} == {
        token["id"] for token in match["right"]
    }  # one id per pair
    assert {token["text"] for token in match["left"]} == {"bebo", "bebes", "el jugo", "quiero"}
    assert (blank["before"], blank["after"], blank["translation"]) == ("Tú", "agua.", "You drink water.")
    assert {option["text"] for option in blank["options"]} == {"bebes", "bebo", "beber"}

    timed = start_session(client, {"kind": "timed"})
    choices = [item["exercise"] for item in timed["items"] if item["exercise"]["type"] == "multiple_choice"]
    listed = [choice for choice in choices if choice["layout"] == "list"]
    assert listed and all(choice["prompt"] is not None for choice in listed)  # "Select the correct meaning"
    assert all(option["imageKey"] is None for choice in listed for option in choice["options"])


def test_answered_items_show_their_result_after_a_refresh(client: TestClient, seeded_engine: Engine) -> None:
    session = start_session(client, lesson_on(client, DRINKS))
    answer_items(client, seeded_engine, session, wrong={1}, limit=2)
    read = client.get(f"{API}/sessions/{session['id']}").json()
    assert [(item["seq"], item["result"]) for item in read["items"]][:2] == [(1, "incorrect"), (2, "correct")]
    retry = read["items"][-1]
    assert (retry["seq"], retry["origin"], retry["label"], retry["result"]) == (
        7,
        "retry",
        "previous_mistake",
        None,
    )
    assert read["currentItemId"] == read["items"][2]["id"]
    assert (read["progress"], read["mistakes"], read["combo"]) == ({"completed": 1, "total": 6}, 1, 1)


def test_another_learners_session_is_not_found(client: TestClient, learner2: int) -> None:
    session = start_session(client, lesson_on(client, DRINKS))
    theirs = as_user(learner2)
    path = f"{API}/sessions/{session['id']}"
    item = session["items"][0]["id"]
    assert_problem(client.get(path, headers=theirs), 404, "NOT_FOUND")
    assert_problem(
        client.put(f"{path}/items/{item}/answer", json={"type": "skip"}, headers=theirs), 404, "NOT_FOUND"
    )
    assert_problem(client.post(f"{path}/complete", headers=theirs), 404, "NOT_FOUND")
    assert_problem(client.post(f"{path}/quit", headers=theirs), 404, "NOT_FOUND")
    assert client.get(path).json()["status"] == "active"


def test_an_unknown_session_or_item_is_not_found(client: TestClient) -> None:
    assert_problem(client.get(f"{API}/sessions/999999"), 404, "NOT_FOUND")
    session = start_session(client, lesson_on(client, DRINKS))
    assert_problem(
        client.put(f"{API}/sessions/{session['id']}/items/999999/answer", json={"type": "skip"}),
        404,
        "NOT_FOUND",
    )


# ---- the idle timeout ----


def test_a_session_left_idle_for_two_hours_is_abandoned(client: TestClient, clock: FrozenClock) -> None:
    session = start_session(client, lesson_on(client, DRINKS))
    clock.advance(hours=2)
    assert get_me(client)["activeSession"]["id"] == session["id"]  # exactly two hours is not yet idle
    clock.advance(seconds=1)
    assert get_me(client)["activeSession"] is None
    ended = client.get(f"{API}/sessions/{session['id']}").json()
    assert (ended["status"], ended["endReason"]) == ("abandoned", "idle_timeout")


def test_answering_keeps_a_session_alive(
    client: TestClient, clock: FrozenClock, seeded_engine: Engine
) -> None:
    session = start_session(client, lesson_on(client, DRINKS))
    clock.advance(hours=1, minutes=59)
    answer_items(client, seeded_engine, session, limit=1)
    clock.advance(hours=1, minutes=59)
    assert get_me(client)["activeSession"]["id"] == session["id"]


# ---- completing ----


def test_completing_twice_replays_one_receipt_and_pays_once(
    client: TestClient, seeded_engine: Engine
) -> None:
    session = start_session(client, lesson_on(client, DRINKS))
    answer_items(client, seeded_engine, session)
    first = complete(client, session["id"])
    second = complete(client, session["id"])
    assert (first["replayed"], second["replayed"]) == (False, True)
    assert {k: v for k, v in second.items() if k not in ("replayed", "me")} == {
        k: v for k, v in first.items() if k not in ("replayed", "me")
    }
    assert second["me"]["xp"]["total"] == first["me"]["xp"]["total"] == 388
    assert xp_lines_of(seeded_engine, session["id"]) == 2  # lesson and combo, written once


def test_completing_with_items_left_is_refused(client: TestClient, seeded_engine: Engine) -> None:
    session = start_session(client, lesson_on(client, DRINKS))
    answer_items(client, seeded_engine, session, limit=5)
    assert_problem(client.post(f"{API}/sessions/{session['id']}/complete"), 409, "SESSION_INCOMPLETE")
    assert client.get(f"{API}/sessions/{session['id']}").json()["status"] == "active"


def test_completing_a_quit_session_is_refused(client: TestClient) -> None:
    session = start_session(client, lesson_on(client, DRINKS))
    assert client.post(f"{API}/sessions/{session['id']}/quit").status_code == 200
    problem = assert_problem(
        client.post(f"{API}/sessions/{session['id']}/complete"), 409, "SESSION_NOT_ACTIVE"
    )
    assert (problem["sessionStatus"], problem["endReason"]) == ("abandoned", "quit")


def test_a_session_from_the_demo_history_has_no_receipt_to_replay(
    client: TestClient, seeded_engine: Engine
) -> None:
    with Session(seeded_engine) as db:
        seeded = db.scalar(select(LessonSession.id).order_by(LessonSession.id).limit(1))
    read = client.get(f"{API}/sessions/{seeded}").json()
    assert (read["status"], read["endReason"], read["canComplete"]) == ("completed", "passed", False)
    problem = assert_problem(client.post(f"{API}/sessions/{seeded}/complete"), 409, "SESSION_NOT_ACTIVE")
    assert (problem["sessionStatus"], problem["endReason"]) == ("completed", "passed")


def _read_as_still_active(monkeypatch: pytest.MonkeyPatch) -> None:
    """Make the next completion read the session as it was before another request ended it.

    Requests are serialized, so a real lost race can't be arranged; the stale read recreates it. The
    session's row is left alone: the completion's compare-and-set still meets the ended row.
    """
    real_read = play_repo.get_owned_session

    def stale_read(db: Session, user_id: int, session_id: int) -> LessonSession | None:
        session = real_read(db, user_id, session_id)
        if session is not None:
            for column, value in (("status", SessionStatus.ACTIVE), ("end_reason", None), ("ended_at", None)):
                set_committed_value(session, column, value)
        return session

    monkeypatch.setattr(play_repo, "get_owned_session", stale_read)


def test_a_completion_that_loses_the_race_replays_the_winners_receipt(
    client: TestClient, seeded_engine: Engine, monkeypatch: pytest.MonkeyPatch
) -> None:
    session = start_session(client, lesson_on(client, DRINKS))
    answer_items(client, seeded_engine, session)
    winner = complete(client, session["id"])
    _read_as_still_active(monkeypatch)
    loser = complete(client, session["id"])
    assert (winner["replayed"], loser["replayed"]) == (False, True)
    assert {k: v for k, v in loser.items() if k not in ("replayed", "me")} == {
        k: v for k, v in winner.items() if k not in ("replayed", "me")
    }
    assert xp_lines_of(seeded_engine, session["id"]) == 2


def test_a_completion_that_loses_the_race_to_a_quit_is_refused(
    client: TestClient, seeded_engine: Engine, monkeypatch: pytest.MonkeyPatch
) -> None:
    session = start_session(client, lesson_on(client, DRINKS))
    answer_items(client, seeded_engine, session)
    client.post(f"{API}/sessions/{session['id']}/quit")
    _read_as_still_active(monkeypatch)
    problem = assert_problem(
        client.post(f"{API}/sessions/{session['id']}/complete"), 409, "SESSION_NOT_ACTIVE"
    )
    assert (problem["sessionStatus"], problem["endReason"]) == ("abandoned", "quit")
    assert xp_lines_of(seeded_engine, session["id"]) == 0


# ---- quitting ----


def test_quitting_ends_the_session_without_xp(client: TestClient, seeded_engine: Engine) -> None:
    session = start_session(client, lesson_on(client, DRINKS))
    answer_items(client, seeded_engine, session, limit=3)
    response = client.post(f"{API}/sessions/{session['id']}/quit")
    assert response.status_code == 200
    assert response.json() == {
        "sessionId": session["id"],
        "status": "abandoned",
        "endReason": "quit",
        "replayed": False,
        "hearts": session["hearts"],  # no mistakes, so no heart was lost
    }
    me = get_me(client)
    assert (me["activeSession"], me["xp"]["total"]) == (None, 373)


def test_quitting_twice_replays_the_outcome(client: TestClient) -> None:
    session = start_session(client, lesson_on(client, DRINKS))
    first = client.post(f"{API}/sessions/{session['id']}/quit").json()
    second = client.post(f"{API}/sessions/{session['id']}/quit").json()
    assert (first["replayed"], second["replayed"]) == (False, True)
    assert (second["status"], second["endReason"]) == ("abandoned", "quit")


def test_an_ended_session_takes_no_more_answers(client: TestClient) -> None:
    session = start_session(client, lesson_on(client, DRINKS))
    client.post(f"{API}/sessions/{session['id']}/quit")
    item = session["items"][0]["id"]
    problem = assert_problem(
        client.put(f"{API}/sessions/{session['id']}/items/{item}/answer", json={"type": "skip"}),
        409,
        "SESSION_NOT_ACTIVE",
    )
    assert (problem["sessionStatus"], problem["endReason"]) == ("abandoned", "quit")
    assert client.get(f"{API}/sessions/{session['id']}").json()["items"][0]["result"] is None
