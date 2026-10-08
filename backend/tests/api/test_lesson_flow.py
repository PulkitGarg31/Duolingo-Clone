"""The golden path of the seeded demo: the last two lessons of "Drinks", then the Unit 2 review.

The sample learner starts at a 13-day streak, at risk, with 0 of 20 XP today and "Drinks" at 1 of 3.
A brand-new learner on a small course shows the same loop from the very first lesson.
"""

from fastapi.testclient import TestClient
from sqlalchemy import Engine

from app.core.db import make_session_factory
from tests.api.contract_keys import CONTRACT_KEYS
from tests.conftest import FROZEN_NOW
from tests.factories import add_catalog, add_learner, add_mini_course
from tests.helpers import API, path_nodes, play_lesson


def test_the_first_lesson_of_the_day_extends_the_streak_to_a_milestone(
    client: TestClient, seeded_engine: Engine
) -> None:
    drinks = path_nodes(client)[(2, 2)]
    receipt = play_lesson(client, seeded_engine, drinks["id"])

    assert set(receipt) == CONTRACT_KEYS["CompletionOut"]
    assert (receipt["kind"], receipt["replayed"]) == ("lesson", False)
    assert receipt["xp"] == {
        "total": 15,
        "lines": [{"reason": "lesson", "amount": 10}, {"reason": "combo", "amount": 5}],
        "boostActive": False,
    }
    assert receipt["stats"] | {"durationSeconds": 0} == {
        "accuracyPercent": 100,
        "durationSeconds": 0,
        "mistakes": 0,
        "bestCombo": 6,
        "perfect": True,
        "itemCount": 6,
    }
    streak = receipt["streak"]
    assert (streak["before"], streak["after"]) == (13, 14)
    assert (streak["extendedToday"], streak["isNewRecord"], streak["milestone"]) == (True, True, True)
    assert [day["state"] for day in streak["week"]] == ["frozen"] + ["active"] * 6  # 10-02 was frozen
    assert receipt["dailyGoal"] == {"goalXp": 20, "before": 0, "after": 15, "justMet": False}
    wildfire = next(unlock for unlock in receipt["achievementsUnlocked"] if unlock["code"] == "wildfire")
    assert (wildfire["level"], wildfire["threshold"], wildfire["description"]) == (
        3,
        14,
        "Reach a 14 day streak",
    )
    assert receipt["node"] == {
        "id": drinks["id"],
        "kind": "skill",
        "title": "Drinks",
        "lessonsCompleted": 2,
        "lessonCount": 3,
        "completedNow": False,
        "legendaryNow": False,
        "unlockedNodeIds": [],
    }
    assert (receipt["heartsGained"], receipt["timed"], receipt["recentSessionCount"]) == (0, None, 6)
    league = receipt["league"]
    assert (league["joinedNow"], league["league"]["name"], league["weeklyXp"]) == (False, "Silver", 57)
    assert league["rankBefore"] is not None and league["rankAfter"] <= league["rankBefore"]

    me = receipt["me"]  # built after the commit
    assert (me["streak"]["current"], me["streak"]["status"]) == (14, "extended")
    assert (me["xp"]["total"], me["xp"]["today"], me["dailyGoal"]["earnedXp"]) == (388, 15, 15)
    assert me["activeSession"] is None


def test_a_second_completion_replays_the_receipt_with_a_fresh_me(
    client: TestClient, seeded_engine: Engine
) -> None:
    receipt = play_lesson(client, seeded_engine, path_nodes(client)[(2, 2)]["id"])
    replay = client.post(f"{API}/sessions/{receipt['sessionId']}/complete")
    assert replay.status_code == 200
    body = replay.json()
    assert body["replayed"] is True
    assert {key: value for key, value in body.items() if key not in ("replayed", "me")} == {
        key: value for key, value in receipt.items() if key not in ("replayed", "me")
    }
    assert body["me"]["xp"]["total"] == receipt["me"]["xp"]["total"]  # nothing was paid twice


def test_drinks_then_the_review_complete_unit_2(client: TestClient, seeded_engine: Engine) -> None:
    nodes = path_nodes(client)
    drinks, chest, review = nodes[(2, 2)]["id"], nodes[(2, 3)]["id"], nodes[(2, 4)]["id"]
    second_lesson = play_lesson(client, seeded_engine, drinks)

    # The node's third and last lesson: today's second session.
    third_lesson = play_lesson(client, seeded_engine, drinks)
    daily_goal = next(quest for quest in third_lesson["questsCompleted"] if quest["code"] == "daily_goal")
    assert (daily_goal["title"], daily_goal["rewardGems"]) == ("Earn 20 XP", 10)
    assert third_lesson["dailyGoal"] == {"goalXp": 20, "before": 15, "after": 30, "justMet": True}
    assert third_lesson["streak"]["extendedToday"] is False  # the first session already counted today
    paid = sum(
        quest["rewardGems"]
        for receipt in (second_lesson, third_lesson)
        for quest in receipt["questsCompleted"]
    )
    assert third_lesson["me"]["gems"] == 820 + paid
    assert (third_lesson["node"]["lessonsCompleted"], third_lesson["node"]["completedNow"]) == (3, True)
    assert third_lesson["node"]["unlockedNodeIds"] == [chest, review]
    after_drinks = path_nodes(client)
    assert [after_drinks[place]["state"] for place in ((2, 2), (2, 3), (2, 4))] == [
        "completed",
        "available",
        "active",
    ]

    review_receipt = play_lesson(client, seeded_engine, review)
    assert review_receipt["xp"]["lines"][0] == {"reason": "review", "amount": 40}
    assert review_receipt["stats"]["itemCount"] == 8
    assert review_receipt["node"]["completedNow"] is True
    path = client.get(f"{API}/me/path").json()
    assert path["units"][1]["state"] == "completed"
    assert path["currentNodeId"] == path["units"][2]["nodes"][0]["id"]  # Unit 3 opens


def test_a_missed_exercise_comes_back_and_costs_a_heart(client: TestClient, seeded_engine: Engine) -> None:
    receipt = play_lesson(client, seeded_engine, path_nodes(client)[(2, 2)]["id"], wrong={3})
    assert receipt["stats"]["mistakes"] == 1
    assert receipt["xp"]["lines"] == [{"reason": "lesson", "amount": 10}, {"reason": "combo", "amount": 4}]
    assert receipt["me"]["hearts"]["current"] == 3


def test_a_new_learner_works_through_a_one_unit_course(bare_client: TestClient, engine: Engine) -> None:
    with make_session_factory(engine)() as db:
        add_catalog(db)
        course = add_mini_course(db)
        add_learner(db, username="alex", joined_at=FROZEN_NOW)  # the default learner
        db.commit()

    first = play_lesson(bare_client, engine, course.skill_id)
    assert (first["streak"]["before"], first["streak"]["after"], first["streak"]["extendedToday"]) == (
        0,
        1,
        True,
    )
    assert first["league"] is None  # leagues open after ten completed sessions
    assert first["node"]["unlockedNodeIds"] == []

    second = play_lesson(bare_client, engine, course.skill_id)
    assert second["node"]["completedNow"] is True
    assert second["node"]["unlockedNodeIds"] == [course.chest_id, course.review_id]
    claim = bare_client.post(f"{API}/me/chests/{course.chest_id}/claim").json()
    assert claim == {
        "nodeId": course.chest_id,
        "gemsAwarded": 20,
        "gems": second["me"]["gems"] + 20,
        "replayed": False,
    }

    review = play_lesson(bare_client, engine, course.review_id)
    assert review["xp"]["lines"][0] == {"reason": "review", "amount": 40}
    path = bare_client.get(f"{API}/me/path").json()
    assert path["currentNodeId"] is None  # the course is finished
    assert path["units"][0]["state"] == "completed"
    assert [node["crownLevel"] for node in path["units"][0]["nodes"]] == [1, 0, 1]
