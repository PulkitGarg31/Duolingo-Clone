"""Treasure chests on the path and the three daily quests.

Finishing "Drinks" (two more lessons for the seeded learner) makes the unit 2 chest reachable. The
seeded learner's daily goal is 20 XP; a perfect lesson earns 15, so the second lesson of the day
completes the "Earn 20 XP" quest. At the frozen instant it is 17:30 in Kolkata, where the day ends
at 18:30 UTC.
"""

from datetime import date

from fastapi.testclient import TestClient
from sqlalchemy import Engine, func, select
from sqlalchemy.orm import Session

from app.core.clock import FrozenClock
from app.domain.enums import GemReason
from app.models import GemTransaction, Quest, QuestClaim
from tests.helpers import API, Json, assert_problem, get_me, node_at, path_nodes, play_lesson


def claim(client: TestClient, node: int) -> Json:
    response = client.post(f"{API}/me/chests/{node}/claim")
    assert response.status_code == 200, response.text
    body: Json = response.json()
    return body


def quests(client: TestClient) -> Json:
    response = client.get(f"{API}/me/quests")
    assert response.status_code == 200, response.text
    body: Json = response.json()
    return body


def daily_goal(quests_out: Json) -> Json:
    quest: Json = quests_out["quests"][0]
    assert (quest["slot"], quest["code"]) == (1, "daily_goal")  # slot 1 is always the daily goal
    return quest


def daily_goal_claims(engine: Engine, day: date) -> tuple[int, int]:
    """The daily-goal quest's claims on `day`, and the gem rows that paid them."""
    with Session(engine) as db:
        claims = (
            select(QuestClaim.id).join(Quest).where(Quest.code == "daily_goal", QuestClaim.local_date == day)
        )
        claimed = db.scalar(select(func.count()).select_from(claims.subquery())) or 0
        paid = db.scalar(
            select(func.count()).where(
                GemTransaction.reason == GemReason.QUEST, GemTransaction.quest_claim_id.in_(claims)
            )
        )
        return claimed, paid or 0


# ---- chests ----


def test_a_chest_ahead_on_the_path_is_locked(client: TestClient) -> None:
    assert_problem(client.post(f"{API}/me/chests/{node_at(client, 2, 3)}/claim"), 409, "CHEST_LOCKED")
    assert get_me(client)["gems"] == 820


def test_a_reachable_chest_pays_its_gems_once(client: TestClient, seeded_engine: Engine) -> None:
    drinks, chest = node_at(client, 2, 2), node_at(client, 2, 3)
    play_lesson(client, seeded_engine, drinks)
    play_lesson(client, seeded_engine, drinks)
    assert path_nodes(client)[(2, 3)]["state"] == "available"
    gems = get_me(client)["gems"]

    assert claim(client, chest) == {"nodeId": chest, "gemsAwarded": 20, "gems": gems + 20, "replayed": False}
    assert claim(client, chest) == {"nodeId": chest, "gemsAwarded": 20, "gems": gems + 20, "replayed": True}
    with Session(seeded_engine) as db:
        rows = db.scalar(
            select(func.count()).where(
                GemTransaction.reason == GemReason.CHEST, GemTransaction.node_id == chest
            )
        )
    assert rows == 1
    opened = path_nodes(client)[(2, 3)]
    assert (opened["state"], opened["crownLevel"]) == ("completed", 0)


# ---- daily quests ----


def test_todays_quests_are_the_same_all_day(client: TestClient, clock: FrozenClock) -> None:
    morning = quests(client)
    assert (morning["localDate"], morning["resetsAt"], morning["serverNow"], morning["completedCount"]) == (
        "2026-10-08",
        "2026-10-08T18:30:00Z",
        "2026-10-08T12:00:00Z",
        0,
    )
    assert [quest["slot"] for quest in morning["quests"]] == [1, 2, 3]
    assert daily_goal(morning) == {
        "code": "daily_goal",
        "slot": 1,
        "title": "Earn 20 XP",
        "icon": "bolt",
        "progress": 0,
        "target": 20,
        "rewardGems": 10,
        "completed": False,
    }
    clock.advance(hours=6)  # 23:30 in Kolkata: still the same day
    evening = quests(client)
    assert [quest["code"] for quest in evening["quests"]] == [quest["code"] for quest in morning["quests"]]


def test_the_daily_goal_quest_pays_once_a_day(client: TestClient, seeded_engine: Engine) -> None:
    drinks = node_at(client, 2, 2)
    first = play_lesson(client, seeded_engine, drinks)
    assert "daily_goal" not in {quest["code"] for quest in first["questsCompleted"]}
    assert daily_goal(quests(client))["progress"] == 15

    second = play_lesson(client, seeded_engine, drinks)
    paid = next(quest for quest in second["questsCompleted"] if quest["code"] == "daily_goal")
    assert paid == {"code": "daily_goal", "title": "Earn 20 XP", "rewardGems": 10}
    assert second["dailyGoal"] == {"goalXp": 20, "before": 15, "after": 30, "justMet": True}

    review = play_lesson(client, seeded_engine, node_at(client, 2, 4))  # a third session the same day
    assert "daily_goal" not in {quest["code"] for quest in review["questsCompleted"]}
    goal = daily_goal(quests(client))
    assert (goal["progress"], goal["completed"]) == (20, True)  # progress is capped at the target
    assert daily_goal_claims(seeded_engine, date(2026, 10, 8)) == (1, 1)


def test_quests_start_over_the_next_day(client: TestClient, seeded_engine: Engine) -> None:
    drinks = node_at(client, 2, 2)
    play_lesson(client, seeded_engine, drinks)
    play_lesson(client, seeded_engine, drinks)
    assert daily_goal(quests(client))["completed"] is True

    assert client.post(f"{API}/dev/clock/next-day").status_code == 200
    tomorrow = quests(client)
    assert (tomorrow["localDate"], tomorrow["resetsAt"], tomorrow["completedCount"]) == (
        "2026-10-09",
        "2026-10-09T18:30:00Z",
        0,
    )
    goal = daily_goal(tomorrow)
    assert (goal["progress"], goal["completed"]) == (0, False)
