"""Practice: global practice (recent mistakes first) and node practice, each earning a heart back.

Practice never costs a heart and re-asks a missed exercise once. Global practice pays 10 XP plus
the combo bonus, practice on a finished node 5 plus the combo bonus.
"""

from fastapi.testclient import TestClient
from sqlalchemy import Engine, select
from sqlalchemy.orm import Session

from app.core.clock import FrozenClock
from app.domain.enums import ItemResult
from app.domain.rules import MISTAKE_LOOKBACK, PRACTICE_MISTAKE_SHARE
from app.models import Exercise, Lesson, LessonSession, SessionItem
from tests.conftest import FROZEN_NOW
from tests.helpers import (
    API,
    answer_for,
    answer_items,
    assert_problem,
    complete,
    get_me,
    load_exercises,
    node_at,
    play_session,
    start_session,
    submit,
)

ONCE = {"heartsEnabled": False, "retryPolicy": "once", "hintsEnabled": True, "maxMistakes": None}


def recent_mistakes(engine: Engine, user_id: int) -> list[int]:
    """The exercises the learner missed or skipped in the last 14 days, most recent mistake first."""
    with Session(engine) as db:
        rows = db.execute(
            select(SessionItem.exercise_id)
            .join(LessonSession, LessonSession.id == SessionItem.session_id)
            .where(
                LessonSession.user_id == user_id,
                SessionItem.result.in_([ItemResult.INCORRECT, ItemResult.SKIPPED]),
                SessionItem.answered_at >= FROZEN_NOW - MISTAKE_LOOKBACK,
            )
            .order_by(SessionItem.answered_at.desc())
        )
        return list(dict.fromkeys(exercise_id for (exercise_id,) in rows))


def test_global_practice_starts_with_recent_mistakes(client: TestClient, seeded_engine: Engine) -> None:
    practice = start_session(client, {"kind": "practice"})
    assert (practice["kind"], practice["node"], practice["lesson"], practice["rules"]) == (
        "practice",
        None,
        None,
        ONCE,
    )
    assert len(practice["items"]) == 10
    mistakes = recent_mistakes(seeded_engine, get_me(client)["user"]["id"])[:PRACTICE_MISTAKE_SHARE]
    assert len(mistakes) == PRACTICE_MISTAKE_SHARE  # the seeded history has six recent mistakes
    first, rest = practice["items"][: len(mistakes)], practice["items"][len(mistakes) :]
    assert [item["exercise"]["id"] for item in first] == mistakes
    assert {item["label"] for item in first} == {"previous_mistake"}
    assert {item["label"] for item in rest} == {None}
    assert not {item["exercise"]["id"] for item in rest} & set(mistakes)


def test_practice_re_asks_a_mistake_once_and_costs_no_heart(
    client: TestClient, seeded_engine: Engine
) -> None:
    practice = start_session(client, {"kind": "practice"})
    (miss,) = answer_items(client, seeded_engine, practice, wrong={1}, limit=1)
    assert (miss["result"], miss["heartLost"], miss["hearts"]["current"]) == ("incorrect", False, 4)
    retry = miss["appendedItem"]
    assert (retry["seq"], retry["origin"], retry["label"]) == (11, "retry", "previous_mistake")
    assert miss["progress"] == {"completed": 0, "total": 10}

    rest = answer_items(
        client, seeded_engine, practice | {"currentItemId": practice["items"][1]["id"]}, limit=9
    )
    assert rest[-1]["session"]["currentItemId"] == retry["id"]
    exercise = load_exercises(seeded_engine, [retry["exercise"]["id"]])[retry["exercise"]["id"]]
    second_miss = submit(client, practice["id"], retry["id"], answer_for(exercise, correct=False)).json()
    assert (second_miss["result"], second_miss["appendedItem"]) == ("incorrect", None)  # no second retry
    assert second_miss["progress"] == {"completed": 10, "total": 10}  # out of retries counts as done
    assert second_miss["session"]["canComplete"] is True

    receipt = complete(client, practice["id"])
    assert receipt["xp"]["lines"] == [{"reason": "practice", "amount": 10}, {"reason": "combo", "amount": 5}]
    assert (receipt["node"], receipt["heartsGained"], receipt["stats"]["mistakes"]) == (None, 1, 2)
    assert (receipt["me"]["hearts"]["current"], receipt["me"]["hearts"]["nextHeartAt"]) == (5, None)


def test_practising_a_finished_node_earns_five_xp_plus_combo(
    client: TestClient, seeded_engine: Engine
) -> None:
    introduce_yourself = node_at(client, 1, 2)
    receipt = play_session(client, seeded_engine, {"kind": "practice", "nodeId": introduce_yourself})
    assert receipt["xp"]["lines"] == [{"reason": "practice", "amount": 5}, {"reason": "combo", "amount": 5}]
    assert receipt["node"] == {
        "id": introduce_yourself,
        "kind": "skill",
        "title": "Introduce yourself",
        "lessonsCompleted": 3,
        "lessonCount": 3,
        "completedNow": False,
        "legendaryNow": False,
        "unlockedNodeIds": [],
    }
    assert receipt["heartsGained"] == 1


def test_node_practice_draws_only_from_the_nodes_lessons(client: TestClient, seeded_engine: Engine) -> None:
    say_hello = node_at(client, 1, 1)  # legendary nodes can still be practised
    practice = start_session(client, {"kind": "practice", "nodeId": say_hello})
    assert practice["node"]["title"] == "Say hello"
    with Session(seeded_engine) as db:
        node_exercises = set(db.scalars(select(Exercise.id).join(Lesson).where(Lesson.node_id == say_hello)))
    assert {item["exercise"]["id"] for item in practice["items"]} <= node_exercises


def test_practice_needs_a_finished_node(client: TestClient) -> None:
    for place, code in (
        ((3, 1), "NODE_LOCKED"),
        ((2, 2), "NODE_NOT_PLAYABLE"),
        ((1, 3), "NODE_NOT_PLAYABLE"),
    ):
        response = client.post(
            f"{API}/sessions", json={"kind": "practice", "nodeId": node_at(client, *place)}
        )
        assert_problem(response, 409, code)
    assert_problem(
        client.post(f"{API}/sessions", json={"kind": "practice", "nodeId": 999_999}), 404, "NOT_FOUND"
    )
    assert get_me(client)["activeSession"] is None


def test_mistakes_older_than_two_weeks_are_not_brought_back(client: TestClient, clock: FrozenClock) -> None:
    clock.advance(days=15)  # the newest seeded mistake was made the evening before the frozen instant
    practice = start_session(client, {"kind": "practice"})
    assert {item["label"] for item in practice["items"]} == {None}
