"""GET /health, GET /me and the settings on the seeded demo, and per-learner isolation through X-User-Id."""

import re
from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app import main
from app.api.deps import get_db
from app.core.clock import FrozenClock
from app.core.db import make_engine, make_session_factory
from app.models import AppState
from tests.api.contract_keys import CONTRACT_KEYS
from tests.api.probes import client_settings
from tests.conftest import FROZEN_NOW, api_settings
from tests.helpers import API, as_user, assert_problem, get_me, node_at, path_nodes, start_session

# The nested objects of MeOut and the contract interface each one follows.
ME_PARTS = {
    "user": "MeUser",
    "course": "CourseBrief",
    "xp": "MeXp",
    "hearts": "HeartsOut",
    "streak": "MeStreak",
    "dailyGoal": "DailyGoalOut",
    "league": "MeLeague",
    "xpBoost": "XpBoostOut",
    "pendingLeagueResult": "LeagueResultOut",
    "settings": "SettingsOut",
    "dev": "DevInfo",
}


def test_health_reports_the_seeded_demo_and_the_boot_id(client: TestClient) -> None:
    response = client.get(f"{API}/health")
    body = response.json()
    assert response.status_code == 200
    assert set(body) == CONTRACT_KEYS["HealthOut"]
    assert (body["status"], body["seeded"], body["serverTime"]) == ("ok", True, "2026-10-08T12:00:00Z")
    assert re.fullmatch(r"[0-9a-f]{32}", body["bootId"])
    assert response.headers["x-boot-id"] == body["bootId"]


def test_the_real_startup_builds_and_seeds_an_empty_database(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    # The app's own startup, pointed at an empty file: tables, the demo seed, then the reference data.
    engine = make_engine(f"sqlite:///{(tmp_path / 'boot' / 'app.db').as_posix()}")
    sessions = make_session_factory(engine)
    monkeypatch.setattr(main, "engine", engine)
    monkeypatch.setattr(main, "SessionLocal", sessions)
    app = main.create_app(api_settings(str(engine.url)))

    def get_test_db() -> Iterator[Session]:
        with sessions() as db:
            yield db

    app.dependency_overrides[get_db] = get_test_db
    try:
        with TestClient(app) as client:
            assert client.get(f"{API}/health").json()["seeded"] is True
            assert client.get(f"{API}/me").json()["streak"]["current"] == 13
    finally:
        engine.dispose()


def test_me_has_exactly_the_contract_keys(client: TestClient) -> None:
    me = client.get(f"{API}/me").json()
    assert set(me) == CONTRACT_KEYS["MeOut"]
    for key, interface in ME_PARTS.items():
        assert set(me[key]) == CONTRACT_KEYS[interface], key
    assert set(me["pendingLeagueResult"]["newLeague"]) == CONTRACT_KEYS["LeagueBrief"]
    assert me["activeSession"] is None


def test_me_shows_the_seeded_demo(client: TestClient) -> None:
    response = client.get(f"{API}/me")
    me = response.json()
    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    assert response.headers["x-server-time"] == me["serverNow"] == "2026-10-08T12:00:00Z"
    assert me["localDate"] == "2026-10-08"  # 17:30 in Kolkata
    assert (me["user"]["username"], me["user"]["timezone"], me["course"]["slug"]) == (
        "alex",
        "Asia/Kolkata",
        "es-en",
    )
    assert me["xp"] == {"total": 373, "today": 0, "thisWeek": 42}
    assert me["gems"] == 820
    assert me["hearts"] == {
        "current": 4,
        "max": 5,
        "nextHeartAt": "2026-10-08T16:00:00Z",  # the seed started the interval an hour ago
        "fullAt": "2026-10-08T16:00:00Z",
        "regenIntervalSeconds": 18000,
        "refillPriceGems": 350,
    }
    assert me["streak"] == {
        "current": 13,
        "longest": 13,
        "status": "at_risk",
        "extendedToday": False,
        "frozenYesterday": False,
        "freezesEquipped": 1,
        "maxFreezes": 2,
        "nextMilestone": 14,
    }
    assert me["dailyGoal"] == {"goalXp": 20, "earnedXp": 0, "met": False}
    assert me["xpBoost"] == {"active": False, "endsAt": None, "multiplier": 2}
    assert me["dev"] == {"enabled": True, "clockOffsetSeconds": 0}


def test_me_shows_the_silver_league_and_last_weeks_promotion(client: TestClient) -> None:
    me = client.get(f"{API}/me").json()
    league = me["league"]
    assert (league["tier"], league["name"], league["unlocked"], league["lessonsToUnlock"]) == (
        2,
        "Silver",
        True,
        0,
    )
    assert (league["joinedThisWeek"], league["weeklyXp"], league["cohortSize"]) == (True, 42, 30)
    assert 1 <= league["rank"] <= 30 and league["zone"] in {"promotion", "safe", "demotion"}
    assert (league["promoteCount"], league["demoteCount"]) == (15, 7)
    assert league["weekEndsAt"] == "2026-10-12T00:00:00Z"
    result = me["pendingLeagueResult"]
    assert (result["weekStart"], result["outcome"], result["seen"]) == ("2026-09-28", "promoted", False)
    assert (result["league"]["name"], result["newLeague"]["name"]) == ("Bronze", "Silver")


def test_each_learner_sees_only_their_own_state(client: TestClient, learner2: int) -> None:
    as_sam = as_user(learner2)
    theirs = client.get(f"{API}/me", headers=as_sam).json()
    assert (theirs["user"]["id"], theirs["user"]["username"]) == (learner2, "sam")
    assert theirs["xp"] == {"total": 0, "today": 0, "thisWeek": 0}
    assert (theirs["gems"], theirs["streak"]["current"], theirs["streak"]["status"]) == (0, 0, "inactive")
    assert (theirs["league"]["unlocked"], theirs["league"]["lessonsToUnlock"]) == (False, 10)
    assert theirs["pendingLeagueResult"] is None

    first_skill = path_nodes(client, headers=as_sam)[(1, 1)]
    assert first_skill["state"] == "active"  # a fresh path starts at the first skill
    started = client.post(
        f"{API}/sessions", json={"kind": "lesson", "nodeId": first_skill["id"]}, headers=as_sam
    )
    assert started.status_code == 201

    mine = client.get(f"{API}/me").json()
    assert (mine["user"]["username"], mine["gems"], mine["xp"]["total"]) == ("alex", 820, 373)
    assert mine["activeSession"] is None
    # Another learner's session is simply not found: ids never leak.
    assert client.get(f"{API}/sessions/{started.json()['id']}").status_code == 404


# ---- settings ----

SEEDED_SETTINGS = {
    "dailyGoalXp": 20,
    "theme": "system",
    "soundEffects": True,
    "animations": True,
    "motivationalMessages": True,
    "listeningExercises": True,
    "timezone": "Asia/Kolkata",
}


def test_the_settings_read_back_as_seeded(client: TestClient) -> None:
    response = client.get(f"{API}/me/settings")
    assert response.status_code == 200
    assert response.json() == SEEDED_SETTINGS == get_me(client)["settings"]


def test_a_settings_patch_changes_only_what_it_sends(client: TestClient) -> None:
    response = client.patch(
        f"{API}/me/settings", json={"dailyGoalXp": 30, "theme": "dark", "soundEffects": False}
    )
    expected = SEEDED_SETTINGS | {"dailyGoalXp": 30, "theme": "dark", "soundEffects": False}
    assert response.status_code == 200
    assert response.json() == expected | {"timezoneEffect": "none"}
    assert client.get(f"{API}/me/settings").json() == expected
    me = get_me(client)
    assert me["dailyGoal"] == {"goalXp": 30, "earnedXp": 0, "met": False}
    assert client.get(f"{API}/me/quests").json()["quests"][0]["title"] == "Earn 30 XP"


@pytest.mark.parametrize(
    ("body", "field"),
    [
        ({}, "body"),
        ({"dailyGoalXp": 15}, "body.dailyGoalXp"),
        ({"theme": "sepia"}, "body.theme"),
        ({"soundEffects": "loud"}, "body.soundEffects"),
        ({"mood": "happy"}, "body.mood"),
    ],
)
def test_an_invalid_settings_patch_changes_nothing(
    client: TestClient, body: dict[str, object], field: str
) -> None:
    problem = assert_problem(client.patch(f"{API}/me/settings", json=body), 422, "VALIDATION_ERROR")
    assert problem["errors"][0]["field"] == field
    assert client.get(f"{API}/me/settings").json() == SEEDED_SETTINGS


def test_turning_listening_off_leaves_listening_exercises_out(client: TestClient) -> None:
    client.patch(f"{API}/me/settings", json={"listeningExercises": False})
    lesson = start_session(client, {"kind": "lesson", "nodeId": node_at(client, 2, 2)})
    assert len(lesson["items"]) == 5  # the sixth exercise of the lesson is a listening one
    assert not any(item["exercise"].get("audioOnly") for item in lesson["items"])
    practice = start_session(client, {"kind": "practice"})
    assert not any(item["exercise"].get("audioOnly") for item in practice["items"])


# ---- GET /health on an empty database ----


def test_health_reports_an_unseeded_database(bare_client: TestClient) -> None:
    response = bare_client.get(f"{API}/health")
    body = response.json()
    assert response.status_code == 200
    assert set(body) == CONTRACT_KEYS["HealthOut"]
    assert (body["status"], body["seeded"], body["version"]) == (
        "ok",
        False,
        client_settings(bare_client).app_version,
    )
    assert body["bootedAt"].endswith("Z")


def test_health_reports_seeding_and_the_demo_clock(
    bare_client: TestClient, db: Session, clock: FrozenClock
) -> None:
    db.add(AppState(id=1, clock_offset_seconds=3600, seeded_at=FROZEN_NOW, seed_version="test"))
    db.commit()
    body = bare_client.get(f"{API}/health").json()
    assert body["seeded"] is True
    assert body["serverTime"] == "2026-10-08T13:00:00Z"  # real time plus the one-hour offset
    clock.advance(minutes=30)
    assert bare_client.get(f"{API}/health").json()["serverTime"] == "2026-10-08T13:30:00Z"
