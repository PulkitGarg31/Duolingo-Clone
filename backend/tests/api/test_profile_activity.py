"""Profiles (learners and league bots) and the day-by-day activity behind the streak calendar.

The seed day is 2026-10-08 in Kolkata. The sample learner studied on the ten days from 09-08 to 09-17
and on every day from 09-24 to 10-07, except 10-02, which a Streak Freeze covered.
"""

from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, select
from sqlalchemy.orm import Session

from app.models import BotProfile, LeagueMembership
from tests.helpers import API, Json, assert_problem, get_me, node_at, play_lesson

ACHIEVEMENTS = ["wildfire", "sage", "scholar", "sharpshooter", "champion", "winner", "legendary"]
SILVER = {"tier": 2, "name": "Silver", "color": "#C9D6E2"}


def profile(client: TestClient, user: int | str) -> Json:
    response = client.get(f"{API}/users/{user}/profile")
    assert response.status_code == 200, response.text
    body: Json = response.json()
    return body


def activity(client: TestClient, **query: str) -> Json:
    response = client.get(f"{API}/me/activity", params=query)
    assert response.status_code == 200, response.text
    body: Json = response.json()
    return body


# ---- profiles ----


def test_the_learner_profile_shows_stats_and_all_seven_achievements(client: TestClient) -> None:
    mine = profile(client, "me")
    assert mine["user"] == {
        "id": mine["user"]["id"],
        "username": "alex",
        "displayName": "Alex",
        "avatarColor": "#1CB0F6",
        "joinedAt": "2026-09-08T06:30:00Z",
        "isMe": True,
        "isBot": False,
    }
    assert mine["stats"] == {
        "currentStreak": 13,
        "longestStreak": 13,
        "totalXp": 373,
        "league": SILVER,
        "topThreeFinishes": 0,
        "wordsLearned": 38,
        "lessonsCompleted": 11,
        "crowns": 5,  # legendary 2 + three completed nodes
    }
    achievements = mine["achievements"]
    assert [a["code"] for a in achievements] == ACHIEVEMENTS
    assert [a["level"] for a in achievements] == [2, 2, 0, 2, 2, 0, 0]
    wildfire = achievements[0]
    assert (wildfire["currentValue"], wildfire["nextThreshold"], wildfire["description"]) == (
        13,
        14,
        "Reach a 14 day streak",
    )
    assert [tier["unlockedAt"] for tier in wildfire["tiers"][:3]] == [
        "2026-10-08T12:00:00Z",
        "2026-10-08T12:00:00Z",
        None,
    ]
    assert profile(client, mine["user"]["id"]) == mine  # "me" is the learner's own id


def test_a_new_level_shows_on_the_profile_with_its_date(client: TestClient, seeded_engine: Engine) -> None:
    play_lesson(client, seeded_engine, node_at(client, 2, 2))  # the streak reaches 14: Wildfire level 3
    wildfire = profile(client, "me")["achievements"][0]
    assert (wildfire["level"], wildfire["currentValue"], wildfire["nextThreshold"]) == (3, 14, 30)
    assert wildfire["tiers"][2]["unlockedAt"] == "2026-10-08T12:00:00Z"


def test_a_bots_profile_agrees_with_the_leaderboard(client: TestClient, seeded_engine: Engine) -> None:
    rows = client.get(f"{API}/me/league").json()["rows"]
    leader = next(row for row in rows if not row["isMe"])
    with Session(seeded_engine) as db:
        baseline = db.scalars(
            select(BotProfile.baseline_xp).where(BotProfile.user_id == leader["userId"])
        ).one()
        finished_weeks = db.scalars(
            select(LeagueMembership.final_xp).where(
                LeagueMembership.user_id == leader["userId"], LeagueMembership.final_xp.is_not(None)
            )
        ).all()

    bot = profile(client, leader["userId"])
    assert (bot["user"]["isBot"], bot["user"]["isMe"], bot["user"]["displayName"]) == (
        True,
        False,
        leader["displayName"],
    )
    stats = bot["stats"]
    assert (
        stats["totalXp"] == baseline + sum(finished_weeks) + leader["xp"]
    )  # this week as the board shows it
    assert (stats["currentStreak"], stats["longestStreak"], stats["league"]) == (
        leader["streak"],
        leader["streak"],
        SILVER,
    )
    assert (stats["wordsLearned"], stats["lessonsCompleted"], stats["crowns"]) == (None, None, None)
    assert [a["code"] for a in bot["achievements"]] == ACHIEVEMENTS
    assert all(tier["unlockedAt"] is None for a in bot["achievements"] for tier in a["tiers"])


def test_profiles_of_unknown_users_are_not_found(client: TestClient) -> None:
    assert_problem(client.get(f"{API}/users/999999/profile"), 404, "NOT_FOUND")
    assert_problem(client.get(f"{API}/users/someone/profile"), 422, "VALIDATION_ERROR")


# ---- activity ----


def test_activity_covers_the_last_five_weeks_day_by_day(client: TestClient) -> None:
    body = activity(client)
    assert (body["from"], body["to"], body["today"]) == ("2026-09-04", "2026-10-08", "2026-10-08")
    items = body["items"]
    assert [item["date"] for item in items] == [
        (date(2026, 9, 4) + timedelta(days=n)).isoformat() for n in range(35)
    ]  # dense, oldest first
    days = {item["date"]: item for item in items}
    assert days["2026-10-02"] == {
        "date": "2026-10-02",
        "xp": 0,
        "goalXp": None,
        "goalMet": False,
        "state": "frozen",
    }
    assert days["2026-09-24"] == {
        "date": "2026-09-24",
        "xp": 44,
        "goalXp": 20,
        "goalMet": True,
        "state": "active",
    }
    assert days["2026-10-07"] == {
        "date": "2026-10-07",
        "xp": 13,
        "goalXp": 20,
        "goalMet": False,
        "state": "active",
    }
    assert days["2026-10-08"] == {
        "date": "2026-10-08",
        "xp": 0,
        "goalXp": None,
        "goalMet": False,
        "state": "none",
    }
    assert [days[f"2026-09-{d}"]["state"] for d in range(18, 24)] == ["none"] * 6  # the lost streak's gap
    assert sum(item["xp"] for item in items) == 373
    assert sum(item["state"] == "active" for item in items) == 23


def test_todays_activity_follows_a_new_daily_goal(client: TestClient, seeded_engine: Engine) -> None:
    play_lesson(client, seeded_engine, node_at(client, 2, 2))
    today = activity(client)["items"][-1]
    assert (today["xp"], today["goalXp"], today["goalMet"], today["state"]) == (15, 20, False, "active")
    response = client.patch(f"{API}/me/settings", json={"dailyGoalXp": 10})
    assert response.json()["dailyGoalXp"] == 10
    days = activity(client)["items"]
    assert (days[-1]["goalXp"], days[-1]["goalMet"]) == (10, True)
    assert days[-2]["goalXp"] == 20  # earlier days keep the goal they had
    assert get_me(client)["dailyGoal"] == {"goalXp": 10, "earnedXp": 15, "met": True}


def test_a_chosen_range_is_returned_whole(client: TestClient) -> None:
    body = activity(client, **{"from": "2026-07-09", "to": "2026-10-08"})  # 92 days, the most allowed
    assert len(body["items"]) == 92
    assert (body["items"][0]["date"], body["items"][0]["state"]) == ("2026-07-09", "none")
    one_day = activity(client, **{"from": "2026-10-02", "to": "2026-10-02"})
    assert [item["state"] for item in one_day["items"]] == ["frozen"]


@pytest.mark.parametrize(
    "query",
    [
        {"from": "2026-10-08", "to": "2026-10-01"},  # backwards
        {"to": "2026-10-09"},  # tomorrow
        {"from": "2026-07-08", "to": "2026-10-08"},  # 93 days
        {"to": "0001-01-01"},  # the default start, five weeks back, would fall before year 1
        {"to": "0001-02-03"},  # the last such day
    ],
)
def test_an_activity_range_must_end_by_today_and_span_at_most_92_days(
    client: TestClient, query: dict[str, str]
) -> None:
    assert_problem(client.get(f"{API}/me/activity", params=query), 422, "VALIDATION_ERROR")


def test_activity_dates_must_be_calendar_dates(client: TestClient) -> None:
    response = client.get(f"{API}/me/activity", params={"from": "last week"})
    problem = assert_problem(response, 422, "VALIDATION_ERROR")
    assert problem["errors"][0]["field"] == "query.from"
