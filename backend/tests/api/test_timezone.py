"""Changing the learner's time zone with PATCH /me/settings.

The same zone only confirms it. A new zone for the sample learner, who has never confirmed one and has
neither played nor spent since the demo was seeded, rebuilds the sample history in that zone
("reseeded"), so every stored day is a day of the new zone. Any other new zone moves the streak's last
day by the difference between the two zones' dates ("shifted"), so the gap to today is unchanged: the
streak is neither broken nor inflated. Either way the zone counts as confirmed, so the app stops
offering to adopt the device's zone.

At the frozen instant (12:00 UTC) it is 17:30 on the 8th in Kolkata, 01:00 on the 9th in Auckland and
05:00 on the 8th in Los Angeles. At 20:00 UTC it is already the 9th in Kolkata, still the 8th in Los
Angeles.

A shift moves the streak's last day but not the calendar days already written, so the tests that
shift are marked `zone_shifted`; after a rebuild every invariant holds in full.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, update
from sqlalchemy.orm import Session

from app.core.clock import FrozenClock
from app.models import User
from tests.helpers import API, Json, as_user, assert_problem, buy, get_me, node_at, play_lesson

DEFAULT_SETTINGS: Json = {
    "dailyGoalXp": 20,
    "theme": "system",
    "soundEffects": True,
    "animations": True,
    "motivationalMessages": True,
    "listeningExercises": True,
}


def change_zone(client: TestClient, zone: str, *, headers: dict[str, str] | None = None) -> Json:
    response = client.patch(f"{API}/me/settings", json={"timezone": zone}, headers=headers)
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


def test_an_old_name_for_the_same_zone_is_not_a_move(client: TestClient) -> None:
    # Chrome reports India as "Asia/Calcutta"; it is the seed zone under its old name.
    settings = change_zone(client, "Asia/Calcutta")
    assert (settings["timezone"], settings["timezoneEffect"]) == ("Asia/Kolkata", "none")
    assert get_me(client)["user"]["timezone"] == "Asia/Kolkata"


# ---- the first visit: the untouched sample history is rebuilt in the new zone ----


def test_the_first_visit_rebuilds_the_sample_history_in_the_visitors_zone(
    client: TestClient, clock: FrozenClock
) -> None:
    # The demo is seeded at 20:00 UTC, when it is already the 9th in Kolkata: yesterday there, the
    # 8th with its 13 XP, is still today in Los Angeles.
    clock.advance(hours=8)
    assert client.post(f"{API}/dev/reset").status_code == 200
    seeded = get_me(client)
    assert (seeded["localDate"], seeded["user"]["timezoneConfirmed"]) == ("2026-10-09", False)

    settings = change_zone(client, "America/Los_Angeles")
    assert settings == DEFAULT_SETTINGS | {"timezone": "America/Los_Angeles", "timezoneEffect": "reseeded"}

    me = get_me(client)
    assert (me["user"]["timezone"], me["user"]["timezoneConfirmed"], me["localDate"]) == (
        "America/Los_Angeles",
        True,
        "2026-10-08",
    )
    assert (me["xp"]["total"], me["xp"]["today"], me["dailyGoal"]["earnedXp"], me["dailyGoal"]["met"]) == (
        373,
        0,
        0,
        False,
    )
    streak = me["streak"]
    assert (streak["current"], streak["status"], streak["freezesEquipped"]) == (13, "at_risk", 1)
    quests = client.get(f"{API}/me/quests").json()["quests"]
    assert [(quest["progress"], quest["completed"]) for quest in quests] == [(0, False)] * 3
    *_, yesterday, today = client.get(f"{API}/me/activity").json()["items"]
    assert (yesterday["date"], yesterday["state"], yesterday["xp"]) == ("2026-10-07", "active", 13)
    assert (today["date"], today["state"], today["xp"]) == ("2026-10-08", "none", 0)

    # Last week's promotion waits again, under a rebuilt membership: the old id no longer exists.
    result, old_id = me["pendingLeagueResult"], seeded["pendingLeagueResult"]["membershipId"]
    assert (result["outcome"], result["seen"]) == ("promoted", False)
    assert result["membershipId"] != old_id
    assert_problem(client.post(f"{API}/me/league/results/{old_id}/ack"), 404, "NOT_FOUND")


def test_a_rebuild_puts_the_clock_back_on_real_time(client: TestClient) -> None:
    client.post(f"{API}/dev/clock/next-day")  # moving the clock is not playing: the demo is still untouched
    response = client.patch(f"{API}/me/settings", json={"timezone": "America/Los_Angeles"})
    assert response.json()["timezoneEffect"] == "reseeded"
    assert response.headers["x-server-time"] == "2026-10-08T12:00:00Z"
    demo_clock = client.get(f"{API}/dev/clock").json()
    assert (demo_clock["offsetSeconds"], demo_clock["now"], demo_clock["localDate"]) == (
        0,
        "2026-10-08T12:00:00Z",
        "2026-10-08",
    )


@pytest.mark.parametrize(
    ("confirmed_first", "effect"),
    [(False, "reseeded"), pytest.param(True, "shifted", marks=pytest.mark.zone_shifted)],
)
def test_a_zone_change_can_come_with_other_settings(
    client: TestClient, confirmed_first: bool, effect: str
) -> None:
    if confirmed_first:
        change_zone(client, "Asia/Kolkata")
    response = client.patch(f"{API}/me/settings", json={"timezone": "America/New_York", "theme": "dark"})
    saved = DEFAULT_SETTINGS | {"theme": "dark", "timezone": "America/New_York"}
    assert response.json() == saved | {"timezoneEffect": effect}
    assert client.get(f"{API}/me/settings").json() == saved  # a rebuild keeps the rest of the PATCH


# ---- later changes: the streak's last day shifts ----


@pytest.mark.zone_shifted
def test_a_new_zone_keeps_the_streaks_gap_to_today(client: TestClient) -> None:
    change_zone(client, "Asia/Kolkata")  # confirmed: no first-visit rebuild any more
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


@pytest.mark.zone_shifted
@pytest.mark.parametrize("touch", ["lesson", "purchase"])
def test_once_the_learner_has_played_or_spent_a_new_zone_shifts(
    client: TestClient, seeded_engine: Engine, touch: str
) -> None:
    if touch == "lesson":
        play_lesson(client, seeded_engine, node_at(client, 2, 2))
    else:
        assert buy(client, "streak_freeze").status_code == 201
    before = get_me(client)
    assert change_zone(client, "Pacific/Auckland")["timezoneEffect"] == "shifted"
    after = get_me(client)
    assert after["streak"] == before["streak"]  # "extended" after the lesson, "at_risk" after the purchase
    assert (after["xp"]["total"], after["gems"]) == (before["xp"]["total"], before["gems"])  # nothing rebuilt


@pytest.mark.zone_shifted
def test_a_zone_change_after_todays_lesson_keeps_today_done(
    client: TestClient, seeded_engine: Engine
) -> None:
    play_lesson(client, seeded_engine, node_at(client, 2, 2))
    assert change_zone(client, "Pacific/Auckland")["timezoneEffect"] == "shifted"
    streak = get_me(client)["streak"]
    assert (streak["current"], streak["status"], streak["extendedToday"]) == (14, "extended", True)
    assert change_zone(client, "Asia/Kolkata")["timezoneEffect"] == "shifted"  # and back again
    assert get_me(client)["streak"]["status"] == "extended"


@pytest.mark.zone_shifted
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


def test_another_learner_never_rebuilds_the_demo(
    client: TestClient, seeded_engine: Engine, learner2: int
) -> None:
    with Session(seeded_engine) as db:  # a second learner who never confirmed a zone either
        db.execute(update(User).where(User.id == learner2).values(timezone_confirmed=False))
        db.commit()
    settings = change_zone(client, "America/Los_Angeles", headers=as_user(learner2))
    assert settings["timezoneEffect"] == "shifted"  # only the sample learner has a seeded history
    sample = get_me(client)
    assert (sample["user"]["timezone"], sample["xp"]["total"], sample["gems"]) == ("Asia/Kolkata", 373, 820)


@pytest.mark.parametrize("zone", ["Mars/Olympus_Mons", "asia/kolkata", "", "UTC+5"])
def test_an_unknown_zone_is_refused(client: TestClient, zone: str) -> None:
    problem = assert_problem(
        client.patch(f"{API}/me/settings", json={"timezone": zone}), 422, "VALIDATION_ERROR"
    )
    assert problem["errors"][0]["field"] == "body.timezone"
    me = get_me(client)
    assert (me["user"]["timezone"], me["user"]["timezoneConfirmed"]) == ("Asia/Kolkata", False)
