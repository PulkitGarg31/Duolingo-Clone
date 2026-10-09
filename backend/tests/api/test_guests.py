"""Guests: every visitor's private copy of the demo.

POST /auth/demo creates a guest, a learner without credentials that starts with the seeded learner's
sample history, and signs it in. Each guest is a sandbox of its own: one guest's lessons, purchases,
time travel and reset never reach another guest or the shared demo learner, who is still served to
requests without a token (the API docs, curl). At most MAX_GUESTS are kept, the oldest going first.

At the frozen instant (12:00 UTC) it is 17:30 on the 8th in Kolkata, 05:00 on the 8th in Los Angeles
and 01:00 on the 9th in Auckland.
"""

import re

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.domain.rules import MAX_GUESTS
from app.models import (
    ActivityDay,
    AuthSession,
    BotProfile,
    GemTransaction,
    LeagueCohort,
    LeagueMembership,
    LessonSession,
    Purchase,
    SessionItem,
    User,
    UserAchievement,
    UserSettings,
    UserStats,
    XpEvent,
)
from app.services import auth_service
from tests.helpers import (
    API,
    Json,
    assert_problem,
    bearer,
    buy,
    get_me,
    path_nodes,
    play_lesson,
    signup,
)

GUEST_USERNAME = re.compile(r"guest_[0-9a-f]{10}")
# What the first screen shows, for the shared learner and a new guest in the same zone alike.
FIRST_SCREEN = (
    "course", "serverNow", "localDate", "xp", "gems", "hearts", "streak", "dailyGoal", "xpBoost",
    "activeSession", "settings",
)  # fmt: skip
# Every table that holds a learner's own rows, by the column naming the learner.
OWN_ROWS = (
    LessonSession.user_id, XpEvent.user_id, GemTransaction.user_id, Purchase.user_id, ActivityDay.user_id,
    UserAchievement.user_id, UserStats.user_id, UserSettings.user_id, AuthSession.user_id,
    LeagueCohort.owner_user_id, LeagueMembership.user_id,
)  # fmt: skip


def start_demo(client: TestClient, timezone: str | None = "Asia/Kolkata") -> Json:
    """POST /auth/demo with the device's zone (none when `timezone` is None); returns the answer."""
    response = client.post(f"{API}/auth/demo", json={} if timezone is None else {"timezone": timezone})
    assert response.status_code == 201, response.text
    started: Json = response.json()
    return started


def guest(client: TestClient, timezone: str | None = "Asia/Kolkata") -> dict[str, str]:
    """The request headers of a new guest."""
    return bearer(start_demo(client, timezone)["token"])


def drinks(client: TestClient, headers: dict[str, str] | None = None) -> Json:
    """The Drinks node (unit 2, position 2): the sample learner's current lesson."""
    return path_nodes(client, headers=headers)[(2, 2)]


def screens(client: TestClient, headers: dict[str, str] | None = None) -> dict[str, Json]:
    """Everything a learner's pages show, to compare before and after someone else acts."""
    pages = {"path": "/me/path", "league": "/me/league", "quests": "/me/quests", "clock": "/dev/clock"}
    shown = {name: client.get(f"{API}{url}", headers=headers).json() for name, url in pages.items()}
    shown["activity"] = client.get(f"{API}/me/activity", headers=headers).json()
    shown["profile"] = client.get(f"{API}/users/me/profile", headers=headers).json()
    return {"me": get_me(client, headers=headers), **shown}


def change_zone(client: TestClient, zone: str, *, headers: dict[str, str] | None = None) -> Json:
    response = client.patch(f"{API}/me/settings", json={"timezone": zone}, headers=headers)
    assert response.status_code == 200, response.text
    body: Json = response.json()
    return body


def guest_ids(engine: Engine) -> list[int]:
    with Session(engine) as db:
        return list(db.scalars(select(User.id).where(User.is_guest).order_by(User.id)))


# ---- a new guest ----


def test_a_new_guest_starts_with_the_seeded_learners_history(client: TestClient) -> None:
    response = client.post(f"{API}/auth/demo", json={"timezone": "Asia/Kolkata"})
    assert response.status_code == 201, response.text
    assert "x-server-time" not in response.headers  # starting a demo acts as no learner yet
    started = response.json()
    user = started["user"]
    assert GUEST_USERNAME.fullmatch(user["username"])
    assert (user["displayName"], user["avatarColor"], user["email"], user["isDemo"]) == (
        "Alex",
        "#1CB0F6",
        None,
        True,
    )
    assert (user["timezone"], user["timezoneConfirmed"]) == ("Asia/Kolkata", True)
    assert started["expiresAt"] == "2026-11-07T12:00:00Z"  # 30 days of real time, like any token

    headers = bearer(started["token"])
    me = get_me(client, headers=headers)
    assert me["user"] == user
    assert (me["xp"], me["gems"], me["hearts"]["current"]) == (
        {"total": 373, "today": 0, "thisWeek": 42},
        820,
        4,
    )
    streak = me["streak"]
    assert (streak["current"], streak["status"], streak["freezesEquipped"]) == (13, "at_risk", 1)
    result = me["pendingLeagueResult"]
    assert (result["outcome"], result["seen"], result["newLeague"]["name"]) == ("promoted", False, "Silver")
    assert (me["league"]["name"], me["dev"]) == ("Silver", {"enabled": True, "clockOffsetSeconds": 0})
    node = drinks(client, headers=headers)
    assert (node["title"], node["state"], node["lessonsCompleted"], node["lessonCount"]) == (
        "Drinks",
        "active",
        1,
        3,
    )

    # The shared learner's first screen, under rows of its own.
    shared = get_me(client)
    assert shared["user"]["username"] == "alex"  # still who a request without a token acts as
    assert {key: me[key] for key in FIRST_SCREEN} == {key: shared[key] for key in FIRST_SCREEN}
    assert user["joinedAt"] == shared["user"]["joinedAt"]
    assert user["id"] != shared["user"]["id"]
    assert result["membershipId"] != shared["pendingLeagueResult"]["membershipId"]


def test_every_guest_is_a_new_learner(client: TestClient) -> None:
    first, second = start_demo(client), start_demo(client)
    assert first["user"]["id"] != second["user"]["id"]
    assert first["user"]["username"] != second["user"]["username"]
    assert first["token"] != second["token"]


def test_a_body_is_optional(client: TestClient) -> None:
    response = client.post(f"{API}/auth/demo")
    assert response.status_code == 201, response.text
    user = response.json()["user"]
    assert (user["timezone"], user["timezoneConfirmed"]) == ("Asia/Kolkata", False)  # the seed zone


# ---- every guest is a sandbox ----


def test_one_guests_lesson_purchase_time_travel_and_reset_reach_no_one_else(
    client: TestClient, seeded_engine: Engine
) -> None:
    a, b = guest(client), guest(client)
    b_before, shared_before = screens(client, b), screens(client)

    receipt = play_lesson(client, seeded_engine, drinks(client, headers=a)["id"], headers=a)
    assert receipt["xp"]["total"] > 0
    gems_before = get_me(client, headers=a)["gems"]
    assert buy(client, "streak_freeze", headers=a).status_code == 201
    assert client.post(f"{API}/dev/clock/next-day", headers=a).status_code == 200
    a_moved = get_me(client, headers=a)
    assert (a_moved["xp"]["total"], a_moved["gems"]) == (373 + receipt["xp"]["total"], gems_before - 200)
    assert a_moved["dev"]["clockOffsetSeconds"] > 0
    assert drinks(client, headers=a)["lessonsCompleted"] == 2
    assert screens(client, b) == b_before
    assert screens(client) == shared_before

    reset = client.post(f"{API}/dev/reset", headers=a)
    assert reset.status_code == 200, reset.text
    a_after = reset.json()["me"]
    assert (a_after["user"]["id"], a_after["user"]["isDemo"]) == (a_moved["user"]["id"], True)
    assert (a_after["xp"]["total"], a_after["gems"], a_after["streak"]["current"]) == (373, 820, 13)
    assert a_after["dev"]["clockOffsetSeconds"] == 0
    assert drinks(client, headers=a)["lessonsCompleted"] == 1  # the sample history again
    assert screens(client, b) == b_before
    assert screens(client) == shared_before


def test_the_shared_learners_lesson_and_reset_leave_guests_alone(
    client: TestClient, seeded_engine: Engine
) -> None:
    a = guest(client)
    before = screens(client, a)
    play_lesson(client, seeded_engine, drinks(client)["id"])
    assert client.post(f"{API}/dev/clock/next-week").status_code == 200
    assert client.post(f"{API}/dev/reset").status_code == 200
    assert screens(client, a) == before


def test_guests_compete_in_cohorts_of_their_own(client: TestClient, seeded_engine: Engine) -> None:
    a, b = guest(client), guest(client)
    ids = {get_me(client, headers=headers)["user"]["id"] for headers in (a, b)} | {
        get_me(client)["user"]["id"]
    }
    with Session(seeded_engine) as db:
        bots = set(db.scalars(select(BotProfile.user_id)))
    for headers in (a, b, None):
        rows = client.get(f"{API}/me/league", headers=headers).json()["rows"]
        humans = {row["userId"] for row in rows} - bots
        assert len(rows) == 30 and len(humans) == 1 and humans <= ids


# ---- time zones ----


@pytest.mark.parametrize(
    ("zone", "local_date"),
    [
        ("America/Los_Angeles", "2026-10-08"),
        ("Pacific/Auckland", "2026-10-09"),
        ("Asia/Kolkata", "2026-10-08"),
    ],
)
def test_a_guests_days_are_the_devices_days(client: TestClient, zone: str, local_date: str) -> None:
    headers = guest(client, zone)
    me = get_me(client, headers=headers)
    assert (me["user"]["timezone"], me["user"]["timezoneConfirmed"], me["localDate"]) == (
        zone,
        True,
        local_date,
    )
    assert (me["xp"]["total"], me["xp"]["today"], me["streak"]["current"], me["streak"]["status"]) == (
        373,
        0,
        13,
        "at_risk",
    )
    *_, yesterday, today = client.get(f"{API}/me/activity", headers=headers).json()["items"]
    assert (today["date"], today["state"]) == (local_date, "none")
    assert (yesterday["state"], yesterday["xp"]) == ("active", 13)


def test_an_old_zone_name_is_stored_under_its_current_name(client: TestClient) -> None:
    assert start_demo(client, "Asia/Calcutta")["user"]["timezone"] == "Asia/Kolkata"


@pytest.mark.parametrize("zone", ["Mars/Olympus_Mons", "asia/kolkata", "", "UTC+5"])
def test_an_unknown_zone_is_refused_and_creates_nobody(
    client: TestClient, seeded_engine: Engine, zone: str
) -> None:
    problem = assert_problem(
        client.post(f"{API}/auth/demo", json={"timezone": zone}), 422, "VALIDATION_ERROR"
    )
    assert [error["field"] for error in problem["errors"]] == ["body.timezone"]
    assert guest_ids(seeded_engine) == []


def test_a_guest_without_a_zone_is_rebuilt_in_the_devices_zone_on_its_first_visit(client: TestClient) -> None:
    a, b = guest(client, None), guest(client, None)
    b_before, shared_before = screens(client, b), screens(client)
    assert get_me(client, headers=a)["user"]["timezoneConfirmed"] is False

    assert change_zone(client, "America/Los_Angeles", headers=a)["timezoneEffect"] == "reseeded"
    me = get_me(client, headers=a)
    assert (me["user"]["timezone"], me["user"]["timezoneConfirmed"], me["localDate"]) == (
        "America/Los_Angeles",
        True,
        "2026-10-08",
    )
    assert (me["xp"]["total"], me["gems"], me["streak"]["current"], me["streak"]["status"]) == (
        373,
        820,
        13,
        "at_risk",
    )
    assert screens(client, b) == b_before  # still unconfirmed, in the seed zone
    assert screens(client) == shared_before


@pytest.mark.zone_shifted
def test_a_guest_who_has_played_keeps_their_progress_in_a_new_zone(
    client: TestClient, seeded_engine: Engine
) -> None:
    headers = guest(client, None)
    play_lesson(client, seeded_engine, drinks(client, headers=headers)["id"], headers=headers)
    before = get_me(client, headers=headers)
    assert change_zone(client, "Pacific/Auckland", headers=headers)["timezoneEffect"] == "shifted"
    after = get_me(client, headers=headers)
    assert (after["xp"]["total"], after["gems"], after["streak"]) == (
        before["xp"]["total"],
        before["gems"],
        before["streak"],
    )


def test_the_shared_learners_first_visit_rebuild_leaves_guests_alone(client: TestClient) -> None:
    headers = guest(client, None)
    before = screens(client, headers)
    assert change_zone(client, "America/Los_Angeles")["timezoneEffect"] == "reseeded"
    assert screens(client, headers) == before


@pytest.mark.zone_shifted
def test_a_guests_reset_never_makes_the_shared_learner_look_untouched(
    client: TestClient, seeded_engine: Engine
) -> None:
    play_lesson(client, seeded_engine, drinks(client)["id"])  # the shared learner has played
    played = get_me(client)
    assert client.post(f"{API}/dev/reset", headers=guest(client)).status_code == 200
    assert change_zone(client, "America/Los_Angeles")["timezoneEffect"] == "shifted"  # not rebuilt
    assert get_me(client)["xp"]["total"] == played["xp"]["total"]


# ---- credentials ----


def test_a_guest_cannot_log_in(client: TestClient, seeded_engine: Engine) -> None:
    started = start_demo(client)
    email = f"{started['user']['username']}@example.com"
    response = client.post(f"{API}/auth/login", json={"email": email, "password": "correct horse battery"})
    assert_problem(response, 401, "INVALID_CREDENTIALS")
    with Session(seeded_engine) as db:
        row = db.get(User, started["user"]["id"])
        assert row is not None and (row.is_guest, row.email, row.password_hash) == (True, None, None)
        row.email, row.password_hash = email, "scrypt$16384$8$1$c2FsdA==$aGFzaA=="
        with pytest.raises(IntegrityError, match="ck_users_guest_without_credentials"):
            db.flush()


def test_signing_up_from_a_guest_creates_a_separate_fresh_account(client: TestClient) -> None:
    started = start_demo(client)
    guest_headers = bearer(started["token"])
    assert buy(client, "streak_freeze", headers=guest_headers).status_code == 201

    response = client.post(
        f"{API}/auth/signup",
        json={"displayName": "Ana", "email": "ana@example.com", "password": "correct horse battery"},
        headers=guest_headers,
    )
    assert response.status_code == 201, response.text
    account = response.json()
    assert account["user"]["id"] != started["user"]["id"]
    assert (account["user"]["isDemo"], account["user"]["email"]) == (False, "ana@example.com")
    me = get_me(client, headers=bearer(account["token"]))
    assert (me["xp"]["total"], me["gems"], me["hearts"]["current"], me["streak"]["current"]) == (0, 500, 5, 0)

    kept = get_me(client, headers=guest_headers)  # the guest is still there, as it was
    assert (kept["user"]["id"], kept["xp"]["total"], kept["gems"]) == (started["user"]["id"], 373, 620)


def test_logging_out_ends_a_guests_token(client: TestClient) -> None:
    headers = guest(client)
    assert client.post(f"{API}/auth/logout", headers=headers).json() == {"loggedOut": True}
    assert_problem(client.get(f"{API}/me", headers=headers), 401, "UNAUTHENTICATED")


def test_only_accounts_are_not_demo_learners(client: TestClient) -> None:
    account = signup(client, "ana@example.com")
    assert (
        account["user"]["isDemo"],
        start_demo(client)["user"]["isDemo"],
        get_me(client)["user"]["isDemo"],
    ) == (
        False,
        True,
        True,
    )


# ---- the cap ----


def test_only_the_newest_guests_are_kept(
    client: TestClient, seeded_engine: Engine, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(auth_service, "MAX_GUESTS", 2)
    first = start_demo(client)
    first_headers = bearer(first["token"])
    play_lesson(client, seeded_engine, drinks(client, headers=first_headers)["id"], headers=first_headers)
    assert buy(client, "streak_freeze", headers=first_headers).status_code == 201
    with Session(seeded_engine) as db:
        bots = db.scalar(select(func.count()).select_from(BotProfile))

    started = [first] + [start_demo(client) for _ in range(3)]
    assert guest_ids(seeded_engine) == [started[2]["user"]["id"], started[3]["user"]["id"]]
    for gone in started[:2]:
        assert_problem(client.get(f"{API}/me", headers=bearer(gone["token"])), 401, "UNAUTHENTICATED")
    for kept in started[2:]:
        assert get_me(client, headers=bearer(kept["token"]))["xp"]["total"] == 373

    with Session(seeded_engine) as db:
        gone_ids = [gone["user"]["id"] for gone in started[:2]]
        for column in OWN_ROWS:
            left = db.scalar(select(func.count()).select_from(column.class_).where(column.in_(gone_ids)))
            assert left == 0, column
        assert db.scalar(select(func.count()).select_from(User).where(User.id.in_(gone_ids))) == 0
        cohorts = select(LeagueCohort.id)
        stray = (
            select(func.count())
            .select_from(LeagueMembership)
            .where(LeagueMembership.cohort_id.not_in(cohorts))
        )
        assert db.scalar(stray) == 0  # the bots' places in the deleted cohorts went with them
        sessions = select(LessonSession.id)
        stray_items = (
            select(func.count()).select_from(SessionItem).where(SessionItem.session_id.not_in(sessions))
        )
        assert db.scalar(stray_items) == 0
        assert db.scalar(select(func.count()).select_from(BotProfile)) == bots
    shared = get_me(client)  # the shared learner is never a guest, so never deleted
    assert (shared["user"]["username"], shared["xp"]["total"]) == ("alex", 373)


def test_the_cap_is_the_rule_of_the_game() -> None:
    assert auth_service.MAX_GUESTS == MAX_GUESTS == 500
