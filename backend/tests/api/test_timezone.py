"""Changing the learner's time zone with PATCH /me/settings.

The same zone only confirms it. A new zone moves the streak's last day by the difference between the
two zones' dates, so the gap to today is unchanged: the streak is neither broken nor inflated. Either
way the zone counts as confirmed, so the app stops offering to adopt the device's zone.

At the frozen instant (12:00 UTC) it is 17:30 on the 8th in Kolkata, 01:00 on the 9th in Auckland and
05:00 on the 8th in Los Angeles.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine

from app.core.clock import FrozenClock
from tests.helpers import API, Json, assert_problem, get_me, node_at, play_lesson

# A zone change moves the streak's last day but not the calendar days already written.
pytestmark = pytest.mark.zone_shifted


def change_zone(client: TestClient, zone: str) -> Json:
    response = client.patch(f"{API}/me/settings", json={"timezone": zone})
    assert response.status_code == 200, response.text
    body: Json = response.json()
    return body


def test_the_same_zone_is_only_confirmed(client: TestClient) -> None:
    assert get_me(client)["user"]["timezoneConfirmed"] is False
    settings = change_zone(client, "Asia/Kolkata")
    assert (settings["timezone"], settings["timezoneEffect"]) == ("Asia/Kolkata", "none")
    me = get_me(client)
    assert (me["user"]["timezoneConfirmed"], me["streak"]["current"], me["streak"]["status"]) == (
        True,
        13,
        "at_risk",
    )


def test_a_new_zone_keeps_the_streaks_gap_to_today(client: TestClient) -> None:
    settings = change_zone(client, "Pacific/Auckland")
    assert (settings["timezone"], settings["timezoneEffect"]) == ("Pacific/Auckland", "shifted")
    me = get_me(client)
    assert (me["user"]["timezone"], me["user"]["timezoneConfirmed"], me["localDate"]) == (
        "Pacific/Auckland",
        True,
        "2026-10-09",  # a day ahead of Kolkata
    )
    assert (me["streak"]["current"], me["streak"]["status"]) == (13, "at_risk")  # still due today, not lost
    assert me["settings"]["timezone"] == "Pacific/Auckland"
    activity = client.get(f"{API}/me/activity").json()
    assert (activity["today"], activity["items"][-1]["date"]) == ("2026-10-09", "2026-10-09")


def test_a_zone_change_after_todays_lesson_keeps_today_done(
    client: TestClient, seeded_engine: Engine
) -> None:
    play_lesson(client, seeded_engine, node_at(client, 2, 2))
    assert change_zone(client, "Pacific/Auckland")["timezoneEffect"] == "shifted"
    streak = get_me(client)["streak"]
    assert (streak["current"], streak["status"], streak["extendedToday"]) == (14, "extended", True)
    assert change_zone(client, "Asia/Kolkata")["timezoneEffect"] == "shifted"  # and back again
    assert get_me(client)["streak"]["status"] == "extended"


def test_moving_west_after_a_lesson_does_not_count_a_day_twice(
    client: TestClient, clock: FrozenClock, seeded_engine: Engine
) -> None:
    clock.advance(hours=10)  # 22:00 UTC: already the 9th in Kolkata, still the 8th in Los Angeles
    receipt = play_lesson(client, seeded_engine, node_at(client, 2, 2))
    # The equipped freeze covered the 8th, so the lesson on the 9th extends the streak to 14.
    assert (receipt["streak"]["after"], receipt["me"]["localDate"]) == (14, "2026-10-09")

    assert change_zone(client, "America/Los_Angeles")["timezoneEffect"] == "shifted"
    me = get_me(client)
    assert (me["localDate"], me["streak"]["current"], me["streak"]["status"]) == (
        "2026-10-08",
        14,
        "extended",
    )
    again = play_lesson(client, seeded_engine, node_at(client, 2, 2))  # another lesson on the "same" day
    assert (again["streak"]["after"], again["streak"]["extendedToday"]) == (14, False)


def test_a_zone_change_can_come_with_other_settings(client: TestClient) -> None:
    response = client.patch(f"{API}/me/settings", json={"timezone": "America/New_York", "theme": "dark"})
    assert response.json() == {
        "dailyGoalXp": 20,
        "theme": "dark",
        "soundEffects": True,
        "animations": True,
        "motivationalMessages": True,
        "listeningExercises": True,
        "timezone": "America/New_York",
        "timezoneEffect": "shifted",
    }


@pytest.mark.parametrize("zone", ["Mars/Olympus_Mons", "asia/kolkata", "", "UTC+5"])
def test_an_unknown_zone_is_refused(client: TestClient, zone: str) -> None:
    problem = assert_problem(
        client.patch(f"{API}/me/settings", json={"timezone": zone}), 422, "VALIDATION_ERROR"
    )
    assert problem["errors"][0]["field"] == "body.timezone"
    me = get_me(client)
    assert (me["user"]["timezone"], me["user"]["timezoneConfirmed"]) == ("Asia/Kolkata", False)
