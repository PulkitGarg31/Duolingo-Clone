"""The two challenge modes: legendary runs on a completed skill, and timed practice against the clock.

The seeded learner has 820 gems. "Introduce yourself" (unit 1, position 2) is completed but not yet
legendary; "Say hello" (unit 1, position 1) already is. Timed practice starts at the frozen instant,
12:00:00 UTC, so its clock first runs out at 12:00:30.
"""

from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, func, select
from sqlalchemy.orm import Session

from app.core.clock import FrozenClock
from app.domain.enums import GemReason
from app.models import GemTransaction
from tests.helpers import (
    API,
    Json,
    answer_items,
    as_user,
    assert_problem,
    complete,
    get_me,
    node_at,
    path_nodes,
    play_session,
    set_learner,
    start_session,
)

INTRODUCE_YOURSELF = (1, 2)
FAST_TYPES = {"multiple_choice", "match_pairs", "fill_blank", "translate"}
BONUS_SECONDS = {"multiple_choice": 5, "match_pairs": 5, "fill_blank": 10, "translate": 10}


def legendary_on(client: TestClient, place: tuple[int, int]) -> Json:
    return {"kind": "legendary", "nodeId": node_at(client, *place)}


def fees_paid(engine: Engine, session_id: int) -> int:
    with Session(engine) as db:
        query = select(func.count()).where(
            GemTransaction.reason == GemReason.LEGENDARY_FEE, GemTransaction.session_id == session_id
        )
        return db.scalar(query) or 0


def instant(text: str) -> datetime:
    return datetime.fromisoformat(text.replace("Z", "+00:00")).astimezone(UTC)


# ---- legendary ----


def test_a_legendary_run_charges_its_fee_once(client: TestClient, seeded_engine: Engine) -> None:
    started = client.post(f"{API}/sessions", json=legendary_on(client, INTRODUCE_YOURSELF))
    assert started.status_code == 201
    assert get_me(client)["gems"] == 720
    resumed = client.post(f"{API}/sessions", json=legendary_on(client, INTRODUCE_YOURSELF))
    assert (resumed.status_code, resumed.json()["id"], resumed.json()["resumed"]) == (
        200,
        started.json()["id"],
        True,
    )
    assert get_me(client)["gems"] == 720  # resuming is free
    assert fees_paid(seeded_engine, started.json()["id"]) == 1


def test_a_legendary_run_has_twelve_items_three_lives_and_no_hints(client: TestClient) -> None:
    run = start_session(client, legendary_on(client, INTRODUCE_YOURSELF))
    assert run["rules"] == {
        "heartsEnabled": False,
        "retryPolicy": "never",
        "hintsEnabled": False,
        "maxMistakes": 2,
    }
    assert (run["lives"], run["timer"], run["progress"]) == (
        {"max": 3, "left": 3},
        None,
        {"completed": 0, "total": 12},
    )
    exercises = [item["exercise"] for item in run["items"]]
    assert len(exercises) == 12
    assert "match_pairs" not in {exercise["type"] for exercise in exercises}
    segments = [
        segment
        for exercise in exercises
        if exercise.get("prompt")
        for segment in exercise["prompt"]["segments"]
    ]
    assert segments and all(segment["hint"] is None for segment in segments)
    assert all(item["label"] is None for item in run["items"])


def test_the_third_mistake_fails_the_run_without_xp(client: TestClient, seeded_engine: Engine) -> None:
    run = start_session(client, legendary_on(client, INTRODUCE_YOURSELF))
    results = answer_items(client, seeded_engine, run, wrong={1, 2, 3})
    assert [result["session"]["livesLeft"] for result in results] == [2, 1, 0]
    assert all(result["appendedItem"] is None and not result["heartLost"] for result in results)
    last = results[-1]["session"]
    assert (last["status"], last["endReason"], last["canComplete"]) == ("failed", "too_many_mistakes", False)

    problem = assert_problem(client.post(f"{API}/sessions/{run['id']}/complete"), 409, "SESSION_NOT_ACTIVE")
    assert (problem["sessionStatus"], problem["endReason"]) == ("failed", "too_many_mistakes")
    me = get_me(client)
    assert (me["xp"]["total"], me["gems"], me["hearts"]["current"]) == (
        373,
        720,
        4,
    )  # the fee is not refunded
    assert path_nodes(client)[INTRODUCE_YOURSELF]["state"] == "completed"


def test_two_mistakes_still_pass_the_run(client: TestClient, seeded_engine: Engine) -> None:
    receipt = play_session(client, seeded_engine, legendary_on(client, INTRODUCE_YOURSELF), wrong={1, 12})
    assert receipt["stats"]["mistakes"] == 2
    assert receipt["xp"]["lines"] == [{"reason": "legendary", "amount": 40}, {"reason": "combo", "amount": 5}]


def test_a_passed_run_turns_the_skill_legendary(client: TestClient, seeded_engine: Engine) -> None:
    receipt = play_session(client, seeded_engine, legendary_on(client, INTRODUCE_YOURSELF))
    assert receipt["xp"] == {
        "total": 45,
        "lines": [{"reason": "legendary", "amount": 40}, {"reason": "combo", "amount": 5}],
        "boostActive": False,
    }
    node = receipt["node"]
    assert (node["title"], node["completedNow"], node["legendaryNow"], node["unlockedNodeIds"]) == (
        "Introduce yourself",
        False,
        True,
        [],
    )
    gold = path_nodes(client)[INTRODUCE_YOURSELF]
    assert (gold["state"], gold["crownLevel"]) == ("legendary", 2)
    assert (gold["actions"]["canLegendary"], gold["actions"]["canPractice"]) == (False, True)
    quest_gems = sum(quest["rewardGems"] for quest in receipt["questsCompleted"])  # 45 XP meets the goal
    assert "daily_goal" in {quest["code"] for quest in receipt["questsCompleted"]}
    assert (receipt["streak"]["after"], receipt["me"]["gems"]) == (14, 720 + quest_gems)


def test_a_legendary_run_needs_the_fee(client: TestClient) -> None:
    set_learner(client, gems=99)
    response = client.post(f"{API}/sessions", json=legendary_on(client, INTRODUCE_YOURSELF))
    problem = assert_problem(response, 409, "INSUFFICIENT_GEMS")
    assert (problem["requiredGems"], problem["balance"]) == (100, 99)
    me = get_me(client)
    assert (me["activeSession"], me["gems"]) == (None, 99)


@pytest.mark.parametrize(
    ("place", "code"),
    [
        ((1, 1), "ALREADY_LEGENDARY"),  # "Say hello" is gold already
        ((1, 4), "NODE_NOT_PLAYABLE"),  # a unit review
        ((1, 3), "NODE_NOT_PLAYABLE"),  # a chest
        ((2, 2), "NODE_NOT_PLAYABLE"),  # "Drinks" is not completed yet
        ((3, 1), "NODE_LOCKED"),
    ],
)
def test_only_a_completed_skill_can_go_legendary(
    client: TestClient, place: tuple[int, int], code: str
) -> None:
    assert_problem(client.post(f"{API}/sessions", json=legendary_on(client, place)), 409, code)
    assert get_me(client)["gems"] == 820


# ---- timed practice ----


def test_timed_practice_has_twenty_quick_items_and_a_thirty_second_clock(client: TestClient) -> None:
    run = start_session(client, {"kind": "timed"})
    assert (run["kind"], run["node"], run["lesson"], run["lives"]) == ("timed", None, None, None)
    assert run["rules"] == {
        "heartsEnabled": False,
        "retryPolicy": "never",
        "hintsEnabled": True,
        "maxMistakes": None,
    }
    assert run["timer"] == {
        "startSeconds": 30,
        "bonusSeconds": BONUS_SECONDS,
        "expiresAt": "2026-10-08T12:00:30Z",
    }
    assert run["progress"] == {"completed": 0, "total": 20}
    assert len(run["items"]) == 20
    assert {item["exercise"]["type"] for item in run["items"]} <= FAST_TYPES


def test_a_right_answer_adds_its_bonus_to_the_clock(client: TestClient, seeded_engine: Engine) -> None:
    run = start_session(client, {"kind": "timed"})
    first_type = run["items"][0]["exercise"]["type"]
    right, wrong = answer_items(client, seeded_engine, run, wrong={2}, limit=2)
    deadline = instant("2026-10-08T12:00:30Z") + timedelta(seconds=BONUS_SECONDS[first_type])
    assert instant(right["session"]["expiresAt"]) == deadline
    assert instant(wrong["session"]["expiresAt"]) == deadline  # a mistake adds nothing...
    assert (wrong["heartLost"], wrong["appendedItem"], wrong["hearts"]["current"]) == (
        False,
        None,
        4,
    )  # ...and costs nothing
    assert right["progress"] == wrong["progress"] == {"completed": 1, "total": 20}


def test_an_answer_within_the_grace_period_still_counts(
    client: TestClient, clock: FrozenClock, seeded_engine: Engine
) -> None:
    run = start_session(client, {"kind": "timed"})
    clock.advance(seconds=35)  # five seconds past the deadline: the network's allowance
    assert len(answer_items(client, seeded_engine, run, limit=1)) == 1


def test_an_answer_after_the_grace_period_is_refused(client: TestClient, clock: FrozenClock) -> None:
    run = start_session(client, {"kind": "timed"})
    clock.advance(seconds=36)
    response = client.put(
        f"{API}/sessions/{run['id']}/items/{run['items'][0]['id']}/answer", json={"type": "skip"}
    )
    problem = assert_problem(response, 409, "SESSION_EXPIRED")
    assert problem["expiresAt"] == "2026-10-08T12:00:30Z"
    read = client.get(f"{API}/sessions/{run['id']}").json()
    assert (read["status"], read["canComplete"]) == ("active", True)  # time-up is a normal end: complete it


def test_time_up_pays_one_xp_per_right_answer(
    client: TestClient, clock: FrozenClock, seeded_engine: Engine
) -> None:
    run = start_session(client, {"kind": "timed"})
    answer_items(client, seeded_engine, run, wrong={4}, limit=4)
    assert_problem(client.post(f"{API}/sessions/{run['id']}/complete"), 409, "SESSION_INCOMPLETE")
    clock.advance(minutes=2)
    receipt = complete(client, run["id"])
    assert receipt["xp"] == {"total": 3, "lines": [{"reason": "timed", "amount": 3}], "boostActive": False}
    assert receipt["timed"] == {"correct": 3, "answered": 4, "timeUp": True}
    assert (receipt["node"], receipt["heartsGained"]) == (None, 0)
    assert (receipt["streak"]["after"], receipt["streak"]["extendedToday"]) == (14, True)
    assert receipt["stats"]["itemCount"] == 20


def test_answering_every_item_ends_a_timed_run_before_time_is_up(
    client: TestClient, seeded_engine: Engine
) -> None:
    run = start_session(client, {"kind": "timed"})
    results = answer_items(client, seeded_engine, run)
    assert len(results) == 20 and results[-1]["session"]["canComplete"] is True
    receipt = complete(client, run["id"])
    assert receipt["timed"] == {"correct": 20, "answered": 20, "timeUp": False}
    assert receipt["xp"]["lines"] == [{"reason": "timed", "amount": 20}]  # no combo bonus in timed practice


def test_a_timed_run_without_a_right_answer_earns_nothing(client: TestClient, clock: FrozenClock) -> None:
    run = start_session(client, {"kind": "timed"})
    clock.advance(seconds=31)
    receipt = complete(client, run["id"])
    assert receipt["xp"] == {"total": 0, "lines": [], "boostActive": False}
    assert receipt["timed"] == {"correct": 0, "answered": 0, "timeUp": True}
    streak = receipt["streak"]
    assert (streak["before"], streak["after"], streak["extendedToday"], streak["milestone"]) == (
        13,
        13,
        False,
        False,
    )
    assert receipt["dailyGoal"] == {"goalXp": 20, "before": 0, "after": 0, "justMet": False}
    me = receipt["me"]
    assert (me["xp"]["total"], me["streak"]["status"]) == (373, "at_risk")


def test_timed_practice_needs_a_completed_lesson(client: TestClient, learner2: int) -> None:
    response = client.post(f"{API}/sessions", json={"kind": "timed"}, headers=as_user(learner2))
    assert_problem(response, 409, "NOTHING_TO_PRACTICE")
