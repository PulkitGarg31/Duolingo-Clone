"""The wire contract: schema shapes, JSON formats, RFC 9457 problem documents and the standard headers.

Error paths are exercised through probe routes mounted on a real app instance, so every response
passes through the same middleware, CORS and exception handlers as production traffic. A tour of all
27 endpoints on the seeded demo checks every answer, nested objects included, against the recorded
contract, and that every instant in it is written in UTC with a "Z".
"""

import importlib
import json
import logging
import pkgutil
import re
from collections.abc import Iterator
from dataclasses import dataclass, field
from datetime import UTC, date, datetime, timedelta
from enum import Enum
from pathlib import Path
from typing import Any, get_args
from zoneinfo import ZoneInfo

import pytest
from fastapi import APIRouter, Depends, FastAPI, Response
from fastapi.testclient import TestClient
from pydantic import TypeAdapter, ValidationError
from sqlalchemy import Engine
from sqlalchemy.orm import Session

import app.schemas
from app.api.deps import CtxDep, IdempotencyKeyDep, require_dev_tools
from app.api.problems import PROBLEM_JSON, problem_response, problem_responses
from app.api.v1.router import API_V1_PREFIX
from app.core.clock import FrozenClock
from app.core.config import Settings, get_settings
from app.core.errors import (
    AlreadyLegendary,
    AppError,
    BotAccount,
    ChestLocked,
    DevToolsDisabled,
    ErrorCode,
    HeartsAlreadyFull,
    IdempotencyKeyRequired,
    IdempotencyKeyReused,
    InsufficientGems,
    InternalError,
    InvalidAnswer,
    ItemAlreadyAnswered,
    ItemOutOfOrder,
    ItemUnavailable,
    LeagueResultNotReady,
    MaxFreezesEquipped,
    MethodNotAllowed,
    NodeAlreadyCompleted,
    NodeLocked,
    NodeNotPlayable,
    NotFound,
    NothingToPractice,
    OutOfHearts,
    SessionExpired,
    SessionIncomplete,
    SessionNotActive,
    ValidationFailed,
)
from app.domain import enums
from app.domain.enums import EndReason, SessionKind, SessionStatus, XpReason
from app.domain.rules import DAILY_GOAL_OPTIONS
from app.models import AppState, BotProfile, Course, League, User, UserSettings, UserStats
from app.schemas.base import ApiModel, format_instant
from app.schemas.common import DailyGoalXp
from app.schemas.completion import (
    CompletionDailyGoal,
    CompletionOut,
    CompletionReceipt,
    CompletionStats,
    CompletionStreak,
    CompletionXp,
    StreakDayOut,
    XpLineOut,
)
from app.schemas.dev import ClockAdvanceIn, DevLearnerPatchIn
from app.schemas.exercises import ExerciseOut
from app.schemas.me import MeOut
from app.schemas.problems import ProblemDetails
from app.schemas.quests import QuestSlot
from app.schemas.sessions import AnswerIn, BlockedReason, SessionOut, StartSessionIn, TimerOut
from app.schemas.settings import SettingsPatchIn
from app.schemas.shop import ShopUnavailableReason
from tests.api.contract_keys import (
    CONTRACT_KEYS,
    DISCRIMINATED_UNIONS,
    ENDPOINTS,
    INLINE_OBJECT_KEYS,
    INTERFACE_KEYS,
    OBJECT_FIELDS,
    REQUEST_BODIES,
    UNION_VALUES,
)
from tests.conftest import FROZEN_NOW, TEST_ORIGIN, assert_invariants_hold, fresh_app, running, use_database
from tests.helpers import PROBLEM_KEYS, answer_for, assert_problem, load_exercises, use_settings

HEX_ID = re.compile(r"[0-9a-f]{12}")
FRONTEND_TYPES = Path(__file__).resolve().parents[3] / "frontend" / "src" / "lib" / "api" / "types.ts"


def sample_errors() -> list[AppError]:
    """One instance of every concrete application error, with realistic extension values."""
    return [
        ValidationFailed(),
        InvalidAnswer(),
        IdempotencyKeyReused(),
        IdempotencyKeyRequired(),
        NotFound(),
        MethodNotAllowed(),
        BotAccount(),
        DevToolsDisabled(),
        NodeLocked(),
        NodeNotPlayable(),
        NodeAlreadyCompleted(),
        AlreadyLegendary(),
        NothingToPractice(),
        ChestLocked(),
        OutOfHearts(next_heart_at=FROZEN_NOW + timedelta(hours=4)),
        InsufficientGems(required_gems=350, balance=120),
        HeartsAlreadyFull(),
        MaxFreezesEquipped(),
        ItemUnavailable(),
        SessionNotActive(session_status=SessionStatus.FAILED, end_reason=EndReason.TOO_MANY_MISTAKES),
        SessionExpired(expires_at=FROZEN_NOW + timedelta(seconds=30)),
        SessionIncomplete(),
        ItemOutOfOrder(current_item_id=103),
        ItemAlreadyAnswered(),
        LeagueResultNotReady(),
        InternalError(),
    ]


# ---- probe routes: one of each failure the API must render ----


class ProbeGoal(ApiModel):
    daily_goal_xp: DailyGoalXp


probe = APIRouter(prefix=f"{API_V1_PREFIX}/probe")


@probe.get("/errors/{code}")
def raise_app_error(code: ErrorCode) -> None:
    raise next(error for error in sample_errors() if error.code == code)


@probe.get("/crash")
def crash() -> None:
    raise RuntimeError("probe failure")


@probe.post("/goal")
def echo_goal(body: ProbeGoal) -> ProbeGoal:
    return body


@probe.put("/answer")
def accept_answer(body: AnswerIn) -> dict[str, str]:
    return {"type": body.type}


@probe.post("/purchase")
def read_idempotency_key(key: IdempotencyKeyDep) -> dict[str, str]:
    return {"key": key}


@probe.get("/dev", dependencies=[Depends(require_dev_tools)])
def dev_only() -> dict[str, bool]:
    return {"ok": True}


@probe.get("/me")
def whoami(ctx: CtxDep) -> dict[str, int | str]:
    return {"userId": ctx.user.id, "today": ctx.today.isoformat()}


@probe.get("/cached")
def cacheable(response: Response) -> dict[str, bool]:
    response.headers["Cache-Control"] = "public, max-age=300"
    return {"ok": True}


@pytest.fixture(scope="module")
def probe_client() -> Iterator[TestClient]:
    """A client of an app of its own with the probe routes mounted, shared by this module's tests."""
    probe_app = fresh_app()
    probe_app.include_router(probe)
    with running(TestClient(probe_app)) as client:
        yield client


@pytest.fixture
def api(probe_client: TestClient, engine: Engine, clock: FrozenClock) -> Iterator[TestClient]:
    """The probe app on an empty database.

    Once the test is over, the invariants must hold on whatever it created.
    """
    probe_app = probe_client.app
    assert isinstance(probe_app, FastAPI)
    use_database(probe_app, engine, clock)
    yield probe_client
    assert_invariants_hold(engine, clock)


def client_settings(client: TestClient) -> Settings:
    """The settings the client's app is running with."""
    fastapi_app = client.app
    assert isinstance(fastapi_app, FastAPI)
    settings: Settings = fastapi_app.dependency_overrides[get_settings]()
    return settings


def add_people(db: Session) -> tuple[int, int]:
    """The default learner 'alex' (with stats and settings) and one league bot; returns their ids."""
    db.add(
        Course(
            id=1,
            slug="es-en",
            title="Spanish",
            learning_language="es",
            from_language="en",
            tts_locale="es-ES",
            flag_key="es",
            is_published=True,
            position=1,
        )
    )
    db.add(League(tier=1, name="Bronze", color="#D4A880", promote_count=20, demote_count=0))
    db.flush()
    alex = User(
        username="alex",
        display_name="Alex",
        avatar_color="#1CB0F6",
        timezone="Asia/Kolkata",
        current_course_id=1,
        joined_at=FROZEN_NOW,
        stats=UserStats(updated_at=FROZEN_NOW),
        settings=UserSettings(updated_at=FROZEN_NOW),
    )
    bot = User(
        username="kenji",
        display_name="Kenji T.",
        avatar_color="#FF9600",
        timezone="UTC",
        current_course_id=1,
        joined_at=FROZEN_NOW,
        bot_profile=BotProfile(daily_xp=30, rng_seed=7, baseline_xp=900, baseline_streak=12),
    )
    db.add_all([alex, bot])
    db.commit()
    return alex.id, bot.id


# ---- the contract: every schema has exactly the keys the frontend expects ----


def schema_classes() -> dict[str, type[ApiModel]]:
    """Every wire model defined in app.schemas, by class name."""
    for module in pkgutil.iter_modules(app.schemas.__path__):
        importlib.import_module(f"app.schemas.{module.name}")

    def subclasses(cls: type[ApiModel]) -> Iterator[type[ApiModel]]:
        for subclass in cls.__subclasses__():
            yield subclass
            yield from subclasses(subclass)

    return {cls.__name__: cls for cls in subclasses(ApiModel) if cls.__module__.startswith("app.schemas.")}


def wire_keys(model: type[ApiModel]) -> frozenset[str]:
    return frozenset(field.alias or name for name, field in model.model_fields.items())


@pytest.mark.parametrize("name", sorted(CONTRACT_KEYS))
def test_each_schema_has_exactly_the_contract_keys(name: str) -> None:
    model = schema_classes().get(name)
    assert model is not None, f"no schema class named {name}"
    assert wire_keys(model) == CONTRACT_KEYS[name]


def test_every_schema_class_is_part_of_the_contract() -> None:
    assert set(schema_classes()) == set(CONTRACT_KEYS)


@pytest.mark.parametrize("union", [ExerciseOut, AnswerIn], ids=["ExerciseOut", "AnswerIn"])
def test_discriminated_unions_map_each_type_to_its_schema(union: Any) -> None:
    members = get_args(get_args(union)[0])
    by_type = {get_args(member.model_fields["type"].annotation)[0]: member.__name__ for member in members}
    name = "ExerciseOut" if union is ExerciseOut else "AnswerIn"
    assert by_type == DISCRIMINATED_UNIONS[name]


def union_values(union: Any) -> frozenset[str | int]:
    if isinstance(union, type) and issubclass(union, Enum):
        return frozenset(member.value for member in union)
    return frozenset(get_args(union))


LITERAL_ALIASES: dict[str, Any] = {
    "DailyGoalXp": DailyGoalXp,
    "QuestSlot": QuestSlot,
    "ShopUnavailableReason": ShopUnavailableReason,
    "BlockedReason": BlockedReason,
    "ErrorCode": ErrorCode,
}


@pytest.mark.parametrize("name", sorted(UNION_VALUES))
def test_enums_and_literal_types_allow_exactly_the_contract_values(name: str) -> None:
    union = LITERAL_ALIASES.get(name) or getattr(enums, name)
    assert union_values(union) == UNION_VALUES[name]


def test_literal_types_agree_with_the_rules_and_error_codes() -> None:
    assert tuple(get_args(DailyGoalXp)) == DAILY_GOAL_OPTIONS
    assert set(get_args(ShopUnavailableReason)) <= set(ErrorCode)
    assert set(get_args(BlockedReason)) <= set(ErrorCode)


# ---- the contract, cross-checked against the frontend's own copy ----


def _strip_comments(source: str) -> str:
    return re.sub(r"/\*.*?\*/|//[^\n]*", "", source, flags=re.DOTALL)


def _top_level_members(body: str) -> list[str]:
    """Split an interface body at its top-level semicolons; nested object types stay whole."""
    members, depth, start = [], 0, 0
    for index, char in enumerate(body):
        if char in "{[(<":
            depth += 1
        elif char in "}])>":
            depth -= 1
        elif char == ";" and depth == 0:
            members.append(body[start:index])
            start = index + 1
    members.append(body[start:])
    return [member.strip() for member in members if member.strip()]


def _interfaces(source: str) -> dict[str, tuple[str | None, list[str]]]:
    """Each `export interface`: the interface it extends, if any, and its own members."""
    declared: dict[str, tuple[str | None, list[str]]] = {}
    for match in re.finditer(r"export interface (\w+)(?: extends (\w+))? \{", source):
        end, depth = match.end(), 1
        while depth:
            depth += {"{": 1, "}": -1}.get(source[end], 0)
            end += 1
        declared[match.group(1)] = (match.group(2), _top_level_members(source[match.end() : end - 1]))
    return declared


def frontend_interfaces(source: str) -> dict[str, frozenset[str]]:
    """Each `export interface` with its keys, inherited ones included."""
    declared = _interfaces(source)

    def all_keys(name: str) -> frozenset[str]:
        base, members = declared[name]
        own = frozenset(re.match(r"\w+", member).group() for member in members)
        return own | (all_keys(base) if base else frozenset())

    return {name: all_keys(name) for name in declared}


def frontend_object_fields(source: str) -> dict[str, dict[str, str]]:
    """Each interface's own fields typed with a named contract type, written "X" or "X[]".

    `| null` is dropped; inline object types and maps are not named types, so they are left out.
    """
    declared = _interfaces(source)
    named = set(declared) | set(DISCRIMINATED_UNIONS)
    fields: dict[str, dict[str, str]] = {}
    for interface, (_, members) in declared.items():
        for member in members:
            name, _, type_text = member.partition(":")
            kind = type_text.replace("| null", "").strip()
            if re.fullmatch(r"\w+(\[\])?", kind) and kind.removesuffix("[]") in named:
                fields.setdefault(interface, {})[name.strip().rstrip("?")] = kind
    return fields


def frontend_literal_unions(source: str) -> dict[str, frozenset[str | int]]:
    """Each `export type X = "a" | "b"` (or numbers); aliases of other types are skipped."""
    unions = {}
    for name, definition in re.findall(r"export type (\w+)\s*=\s*([^;]+);", source):
        options = [option.strip() for option in definition.split("|") if option.strip()]
        if all(re.fullmatch(r'"\w+"|\d+', option) for option in options):
            unions[name] = frozenset(json.loads(option) for option in options)
    return unions


@pytest.fixture
def frontend_source() -> str:
    if not FRONTEND_TYPES.exists():
        pytest.skip("the frontend is not checked out next to the backend")
    return _strip_comments(FRONTEND_TYPES.read_text(encoding="utf-8"))


def test_the_frontend_interfaces_match_the_recorded_contract(frontend_source: str) -> None:
    assert frontend_interfaces(frontend_source) == INTERFACE_KEYS


def test_the_frontend_unions_match_the_recorded_contract(frontend_source: str) -> None:
    assert frontend_literal_unions(frontend_source) == UNION_VALUES


def test_the_frontend_nests_the_same_objects(frontend_source: str) -> None:
    # The frontend spells some small objects inline (CompletionOut.xp, GuidebookOut.unit, ...); the
    # recorded nesting names them after their backend schemas, so those fields are compared by keys only.
    recorded = {
        parent: {
            name: kind for name, kind in fields.items() if kind.removesuffix("[]") not in INLINE_OBJECT_KEYS
        }
        for parent, fields in OBJECT_FIELDS.items()
        if parent in INTERFACE_KEYS
    }
    assert frontend_object_fields(frontend_source) == {
        parent: fields for parent, fields in recorded.items() if fields
    }


def test_the_recorded_nesting_names_fields_and_types_of_the_contract() -> None:
    for parent, fields in OBJECT_FIELDS.items():
        assert parent in CONTRACT_KEYS, parent
        assert set(fields) <= CONTRACT_KEYS[parent], parent
        for kind in fields.values():
            assert kind.removesuffix("[]") in CONTRACT_KEYS | DISCRIMINATED_UNIONS, kind
    assert {answer_type for _, _, answer_type in ENDPOINTS.values()} <= set(CONTRACT_KEYS) - REQUEST_BODIES


# ---- JSON formats ----


def test_instants_are_iso_utc_with_a_z() -> None:
    assert format_instant(datetime(2026, 10, 8, 12, 0, tzinfo=UTC)) == "2026-10-08T12:00:00Z"
    kolkata = datetime(2026, 10, 8, 17, 30, tzinfo=ZoneInfo("Asia/Kolkata"))
    assert format_instant(kolkata) == "2026-10-08T12:00:00Z"
    with_micros = datetime(2026, 10, 8, 12, 0, 5, 123456, tzinfo=UTC)
    assert format_instant(with_micros) == "2026-10-08T12:00:05.123Z"


def test_a_naive_instant_is_refused() -> None:
    with pytest.raises(ValueError, match="naive"):
        format_instant(datetime(2026, 10, 8, 12, 0))  # noqa: DTZ001 - deliberately naive


def test_every_datetime_field_serializes_through_the_shared_format() -> None:
    timer = TimerOut(
        start_seconds=30,
        bonus_seconds={enums.ExerciseType.MULTIPLE_CHOICE: 5, enums.ExerciseType.FILL_BLANK: 10},
        expires_at=datetime(2026, 10, 8, 17, 40, 30, tzinfo=ZoneInfo("Asia/Kolkata")),
    )
    assert json.loads(timer.model_dump_json()) == {
        "startSeconds": 30,
        # Map keys are data, not field names: they keep the exercise types' snake_case.
        "bonusSeconds": {"multiple_choice": 5, "fill_blank": 10},
        "expiresAt": "2026-10-08T12:10:30Z",
    }
    assert timer.model_dump(mode="json")["expiresAt"] == "2026-10-08T12:10:30Z"
    # In Python mode the value stays a datetime, so models can be rebuilt from a dump.
    assert timer.model_dump()["expiresAt"] == timer.expires_at


# GET /me for the seeded demo, as documented for the frontend.
ME_EXAMPLE: dict[str, Any] = {
    "user": {
        "id": 1,
        "username": "alex",
        "displayName": "Alex",
        "avatarColor": "#1CB0F6",
        "timezone": "Asia/Kolkata",
        "timezoneConfirmed": True,
        "joinedAt": "2026-09-08T06:30:00Z",
    },
    "course": {
        "id": 1,
        "slug": "es-en",
        "title": "Spanish",
        "learningLanguage": "es",
        "fromLanguage": "en",
        "ttsLocale": "es-ES",
        "flagKey": "es",
        "isPublished": True,
    },
    "serverNow": "2026-10-08T12:00:00Z",
    "localDate": "2026-10-08",
    "xp": {"total": 373, "today": 0, "thisWeek": 42},
    "gems": 820,
    "hearts": {
        "current": 4,
        "max": 5,
        "nextHeartAt": "2026-10-08T16:00:00Z",
        "fullAt": "2026-10-08T16:00:00Z",
        "regenIntervalSeconds": 18000,
        "refillPriceGems": 350,
    },
    "streak": {
        "current": 13,
        "longest": 13,
        "status": "at_risk",
        "extendedToday": False,
        "frozenYesterday": False,
        "freezesEquipped": 1,
        "maxFreezes": 2,
        "nextMilestone": 14,
    },
    "dailyGoal": {"goalXp": 20, "earnedXp": 0, "met": False},
    "league": {
        "unlocked": True,
        "lessonsToUnlock": 0,
        "tier": 2,
        "name": "Silver",
        "color": "#C9D6E2",
        "joinedThisWeek": True,
        "rank": 17,
        "weeklyXp": 42,
        "zone": "safe",
        "xpToPassNext": 9,
        "cohortSize": 30,
        "promoteCount": 15,
        "demoteCount": 7,
        "weekEndsAt": "2026-10-12T00:00:00Z",
    },
    "xpBoost": {"active": False, "endsAt": None, "multiplier": 2},
    "activeSession": None,
    "pendingLeagueResult": {
        "membershipId": 31,
        "weekStart": "2026-09-28",
        "league": {"tier": 1, "name": "Bronze", "color": "#D4A880"},
        "finalRank": 6,
        "finalXp": 112,
        "outcome": "promoted",
        "newLeague": {"tier": 2, "name": "Silver", "color": "#C9D6E2"},
        "seen": False,
    },
    "settings": {
        "dailyGoalXp": 20,
        "theme": "system",
        "soundEffects": True,
        "animations": True,
        "motivationalMessages": True,
        "listeningExercises": True,
        "timezone": "Asia/Kolkata",
    },
    "dev": {"enabled": True, "clockOffsetSeconds": 0},
}


def test_the_documented_me_example_round_trips_in_camel_case() -> None:
    me = MeOut.model_validate(ME_EXAMPLE)
    assert me.hearts.next_heart_at == datetime(2026, 10, 8, 16, 0, tzinfo=UTC)
    assert me.league.zone is enums.LeagueZone.SAFE
    assert json.loads(me.model_dump_json()) == ME_EXAMPLE


SESSION_EXAMPLE: dict[str, Any] = {
    "id": 14,
    "kind": "lesson",
    "status": "active",
    "endReason": None,
    "resumed": False,
    "node": {
        "id": 6,
        "kind": "skill",
        "title": "Drinks",
        "unitId": 2,
        "unitNumber": 2,
        "unitColor": "purple",
    },
    "lesson": {"id": 12, "number": 2, "count": 3},
    "rules": {"heartsEnabled": True, "retryPolicy": "always", "hintsEnabled": True, "maxMistakes": None},
    "timer": None,
    "startedAt": "2026-10-08T12:00:05Z",
    "serverNow": "2026-10-08T12:00:05Z",
    "hearts": {
        "current": 4,
        "max": 5,
        "nextHeartAt": "2026-10-08T16:00:00Z",
        "fullAt": "2026-10-08T16:00:00Z",
        "regenIntervalSeconds": 18000,
        "refillPriceGems": 350,
    },
    "lives": None,
    "progress": {"completed": 0, "total": 3},
    "mistakes": 0,
    "combo": 0,
    "bestCombo": 0,
    "currentItemId": 101,
    "blockedReason": None,
    "canComplete": False,
    "items": [
        {
            "id": 101,
            "seq": 1,
            "origin": "initial",
            "label": "new_word",
            "result": None,
            "note": None,
            "exercise": {
                "id": 69,
                "type": "multiple_choice",
                "instruction": "Which one of these is “the juice”?",
                "prompt": None,
                "layout": "pictures",
                "options": [
                    {"id": 301, "text": "el agua", "imageKey": "water"},
                    {"id": 302, "text": "el jugo", "imageKey": "juice"},
                ],
            },
        },
        {
            "id": 102,
            "seq": 2,
            "origin": "initial",
            "label": None,
            "result": None,
            "note": None,
            "exercise": {
                "id": 71,
                "type": "match_pairs",
                "instruction": "Tap the matching pairs",
                "left": [{"id": 41, "text": "el té"}, {"id": 42, "text": "el agua"}],
                "right": [{"id": 42, "text": "the water"}, {"id": 41, "text": "the tea"}],
            },
        },
        {
            "id": 103,
            "seq": 3,
            "origin": "initial",
            "label": None,
            "result": None,
            "note": None,
            "exercise": {
                "id": 74,
                "type": "type_answer",
                "instruction": "Type what you hear",
                "prompt": {"text": "Quiero agua.", "language": "es", "speak": True, "segments": []},
                "audioOnly": True,
                "answerLanguage": "es",
                "specialCharacters": ["á", "é", "í", "ó", "ú", "ñ", "ü", "¿", "¡"],
            },
        },
    ],
}


def test_a_session_round_trips_with_each_exercise_parsed_by_its_type() -> None:
    session = SessionOut.model_validate(SESSION_EXAMPLE)
    assert [type(item.exercise).__name__ for item in session.items] == [
        "MultipleChoiceExercise",
        "MatchPairsExercise",
        "TypeAnswerExercise",
    ]
    assert json.loads(session.model_dump_json()) == SESSION_EXAMPLE


def sample_receipt() -> CompletionReceipt:
    week = [
        StreakDayOut(date=date(2026, 10, 2) + timedelta(days=offset), state=enums.DayState.ACTIVE)
        for offset in range(7)
    ]
    return CompletionReceipt(
        session_id=14,
        kind=SessionKind.LESSON,
        replayed=False,
        xp=CompletionXp(
            total=15,
            lines=[XpLineOut(reason=XpReason.LESSON, amount=10), XpLineOut(reason=XpReason.COMBO, amount=5)],
            boost_active=False,
        ),
        stats=CompletionStats(
            accuracy_percent=100, duration_seconds=98, mistakes=0, best_combo=6, perfect=True, item_count=6
        ),
        streak=CompletionStreak(
            before=13, after=14, extended_today=True, is_new_record=True, milestone=True, week=week
        ),
        daily_goal=CompletionDailyGoal(goal_xp=20, before=0, after=15, just_met=False),
        node=None,
        hearts_gained=0,
        quests_completed=[],
        achievements_unlocked=[],
        league=None,
        timed=None,
        recent_session_count=6,
    )


def test_a_cached_receipt_replays_identically_and_takes_a_fresh_me() -> None:
    receipt = sample_receipt()
    cached = receipt.model_dump_json()
    assert CompletionReceipt.model_validate_json(cached) == receipt
    response = CompletionOut(**receipt.model_dump(), me=MeOut.model_validate(ME_EXAMPLE))
    body = json.loads(response.model_dump_json())
    assert set(body) == CONTRACT_KEYS["CompletionOut"]
    assert body["me"]["gems"] == 820
    assert "me" not in json.loads(cached)


# ---- request validation rules ----


@pytest.mark.parametrize(
    ("payload", "valid"),
    [
        ({"kind": "lesson", "nodeId": 6}, True),
        ({"kind": "lesson"}, False),
        ({"kind": "legendary", "nodeId": 2}, True),
        ({"kind": "legendary"}, False),
        ({"kind": "practice"}, True),
        ({"kind": "practice", "nodeId": 2}, True),
        ({"kind": "timed"}, True),
        ({"kind": "timed", "nodeId": 2}, False),
        ({"kind": "review", "nodeId": 4}, False),
    ],
)
def test_a_session_start_needs_a_node_exactly_when_its_kind_does(
    payload: dict[str, Any], valid: bool
) -> None:
    if valid:
        StartSessionIn.model_validate(payload)
    else:
        with pytest.raises(ValidationError):
            StartSessionIn.model_validate(payload)


@pytest.mark.parametrize(
    ("payload", "valid"),
    [
        ({"type": "translate", "tileIds": [313, 315, 311]}, True),
        ({"type": "translate", "text": "I drink water"}, True),
        ({"type": "translate"}, False),
        ({"type": "translate", "tileIds": [313], "text": "I"}, False),
        ({"type": "translate", "tileIds": []}, False),
        ({"type": "type_answer", "text": ""}, False),
        ({"type": "type_answer", "text": "x" * 201}, False),
        ({"type": "match_pairs", "pairs": [{"leftId": 41, "rightId": 41}], "mistakes": 0}, True),
        ({"type": "match_pairs", "pairs": [], "mistakes": -1}, False),
        ({"type": "skip"}, True),
        ({"type": "skip", "optionId": 3}, False),
        ({"type": "cant_listen"}, True),
        ({"type": "hint"}, False),
    ],
)
def test_answer_payloads_are_checked_against_their_type(payload: dict[str, Any], valid: bool) -> None:
    adapter = TypeAdapter(AnswerIn)
    if valid:
        assert adapter.validate_python(payload).type == payload["type"]
    else:
        with pytest.raises(ValidationError):
            adapter.validate_python(payload)


def test_a_settings_patch_must_change_something_valid() -> None:
    patch = SettingsPatchIn.model_validate({"dailyGoalXp": 30, "theme": None, "timezone": "America/New_York"})
    assert patch.changes() == {"daily_goal_xp": 30, "timezone": "America/New_York"}
    for invalid in (
        {},
        {"theme": None},
        {"dailyGoalXp": 15},
        {"timezone": "Mars/Olympus_Mons"},
        {"mood": "happy"},
    ):
        with pytest.raises(ValidationError):
            SettingsPatchIn.model_validate(invalid)


@pytest.mark.parametrize(
    ("payload", "delta"),
    [
        ({"minutes": 1}, timedelta(minutes=1)),
        ({"hours": 5}, timedelta(hours=5)),
        ({"days": 2, "hours": 3}, timedelta(days=2, hours=3)),
        ({"days": 60}, timedelta(days=60)),
        ({}, None),
        ({"minutes": 0}, None),
        ({"days": 60, "minutes": 1}, None),
        ({"days": 61}, None),
        ({"hours": -1}, None),
    ],
)
def test_the_clock_moves_forward_by_one_minute_to_sixty_days(
    payload: dict[str, int], delta: timedelta | None
) -> None:
    if delta is None:
        with pytest.raises(ValidationError):
            ClockAdvanceIn.model_validate(payload)
    else:
        assert ClockAdvanceIn.model_validate(payload).delta == delta


def test_a_learner_patch_sets_hearts_or_gems_within_range() -> None:
    assert DevLearnerPatchIn.model_validate({"hearts": 0}).hearts == 0
    assert DevLearnerPatchIn.model_validate({"gems": 1320}).gems == 1320
    for invalid in ({}, {"hearts": 6}, {"hearts": -1}, {"gems": -5}):
        with pytest.raises(ValidationError):
            DevLearnerPatchIn.model_validate(invalid)


# ---- problem documents ----


def test_every_application_error_has_a_sample() -> None:
    def subclasses(cls: type[AppError]) -> Iterator[type[AppError]]:
        for subclass in cls.__subclasses__():
            yield subclass
            yield from subclasses(subclass)

    concrete = {cls for cls in subclasses(AppError) if hasattr(cls, "code")}
    samples = sample_errors()
    assert {type(error) for error in samples} == concrete
    assert {error.code for error in samples} == set(ErrorCode)


@pytest.mark.parametrize("error", sample_errors(), ids=lambda error: error.code.value)
def test_every_application_error_renders_as_a_problem_document(error: AppError) -> None:
    response = problem_response(error, instance="/api/v1/me", request_id="6f1c2a9e4b7d")
    body = json.loads(response.body)
    assert response.status_code == error.status
    assert response.media_type == PROBLEM_JSON
    assert set(body) == PROBLEM_KEYS | set(error.extra)
    assert body["type"] == "/problems/" + error.code.value.lower().replace("_", "-")
    assert body["code"] == error.code.value
    assert (body["status"], body["title"], body["detail"]) == (error.status, error.title, error.detail)
    assert (body["instance"], body["requestId"], body["errors"]) == ("/api/v1/me", "6f1c2a9e4b7d", [])


def test_extension_members_use_the_wire_formats() -> None:
    rendered = {
        error.code: json.loads(problem_response(error, instance="/x", request_id="r").body)
        for error in sample_errors()
    }
    assert rendered[ErrorCode.OUT_OF_HEARTS]["nextHeartAt"] == "2026-10-08T16:00:00Z"
    gems = rendered[ErrorCode.INSUFFICIENT_GEMS]
    assert (gems["requiredGems"], gems["balance"]) == (350, 120)
    assert rendered[ErrorCode.SESSION_NOT_ACTIVE]["sessionStatus"] == "failed"
    assert rendered[ErrorCode.SESSION_NOT_ACTIVE]["endReason"] == "too_many_mistakes"
    assert rendered[ErrorCode.SESSION_EXPIRED]["expiresAt"] == "2026-10-08T12:00:30Z"
    assert rendered[ErrorCode.ITEM_OUT_OF_ORDER]["currentItemId"] == 103
    # A member that is defined but has no value is sent as null rather than left out.
    no_heart_due = json.loads(
        problem_response(OutOfHearts(next_heart_at=None), instance="/x", request_id="r").body
    )
    assert no_heart_due["nextHeartAt"] is None


def test_a_conflict_is_a_409_problem_with_its_extension_members(api: TestClient) -> None:
    body = assert_problem(api.get(f"{API_V1_PREFIX}/probe/errors/OUT_OF_HEARTS"), 409, "OUT_OF_HEARTS")
    assert body["nextHeartAt"] == "2026-10-08T16:00:00Z"
    assert body["instance"] == f"{API_V1_PREFIX}/probe/errors/OUT_OF_HEARTS"
    assert body["errors"] == []


def test_an_invalid_body_is_a_422_listing_each_field_by_its_wire_name(api: TestClient) -> None:
    body = assert_problem(
        api.post(f"{API_V1_PREFIX}/probe/goal", json={"dailyGoalXp": 15}), 422, "VALIDATION_ERROR"
    )
    assert body["errors"] == [
        {"field": "body.dailyGoalXp", "message": "Input should be 10, 20, 30 or 50", "kind": "literal_error"}
    ]
    body = assert_problem(
        api.post(f"{API_V1_PREFIX}/probe/goal", json={"dailyGoalXp": 20, "dailyGoal": 20}),
        422,
        "VALIDATION_ERROR",
    )
    assert [error["field"] for error in body["errors"]] == ["body.dailyGoal"]
    assert body["errors"][0]["kind"] == "extra_forbidden"


def test_a_union_error_names_the_answer_type_in_its_path(api: TestClient) -> None:
    body = assert_problem(
        api.put(f"{API_V1_PREFIX}/probe/answer", json={"type": "type_answer"}), 422, "VALIDATION_ERROR"
    )
    assert body["errors"] == [
        {"field": "body.type_answer.text", "message": "Field required", "kind": "missing"}
    ]


def test_malformed_json_is_a_validation_error(api: TestClient) -> None:
    response = api.post(
        f"{API_V1_PREFIX}/probe/goal", content=b"{not json", headers={"Content-Type": "application/json"}
    )
    body = assert_problem(response, 422, "VALIDATION_ERROR")
    assert body["errors"][0]["kind"] == "json_invalid"


def test_bodies_also_accept_snake_case_and_answer_in_camel_case(api: TestClient) -> None:
    response = api.post(f"{API_V1_PREFIX}/probe/goal", json={"daily_goal_xp": 30})
    assert response.status_code == 200
    assert response.json() == {"dailyGoalXp": 30}


def test_an_unknown_route_is_a_404_problem(api: TestClient) -> None:
    body = assert_problem(api.get(f"{API_V1_PREFIX}/nowhere"), 404, "NOT_FOUND")
    assert body["instance"] == f"{API_V1_PREFIX}/nowhere"


def test_a_wrong_method_is_a_405_problem_that_names_the_allowed_ones(api: TestClient) -> None:
    response = api.post(f"{API_V1_PREFIX}/health")
    assert_problem(response, 405, "METHOD_NOT_ALLOWED")
    assert response.headers["allow"] == "GET"


@pytest.mark.parametrize("key", [None, "", "   ", "k" * 65])
def test_a_purchase_without_a_usable_idempotency_key_is_a_400_problem(
    api: TestClient, key: str | None
) -> None:
    headers = {} if key is None else {"Idempotency-Key": key}
    assert_problem(
        api.post(f"{API_V1_PREFIX}/probe/purchase", headers=headers), 400, "IDEMPOTENCY_KEY_REQUIRED"
    )


def test_a_usable_idempotency_key_reaches_the_handler(api: TestClient) -> None:
    key = "0d6c6f5e-55a8-4b6f-9a7e-2f0f4e3e7d11"
    response = api.post(f"{API_V1_PREFIX}/probe/purchase", headers={"Idempotency-Key": key})
    assert response.status_code == 200
    assert response.json() == {"key": key}


def test_dev_tools_answer_403_when_switched_off(api: TestClient) -> None:
    assert api.get(f"{API_V1_PREFIX}/probe/dev").status_code == 200
    use_settings(api, enable_dev_tools=False)
    assert_problem(api.get(f"{API_V1_PREFIX}/probe/dev"), 403, "DEV_TOOLS_DISABLED")


def test_an_unexpected_exception_is_a_generic_500_problem_that_keeps_cors_headers(
    api: TestClient, caplog: pytest.LogCaptureFixture
) -> None:
    with caplog.at_level(logging.ERROR, logger="app"):
        response = api.get(f"{API_V1_PREFIX}/probe/crash", headers={"Origin": TEST_ORIGIN})
    body = assert_problem(response, 500, "INTERNAL_ERROR")
    assert body["detail"] == InternalError.default_detail  # never the exception text
    assert "probe failure" not in response.text
    assert response.headers["access-control-allow-origin"] == TEST_ORIGIN
    assert "X-Boot-Id" in response.headers["access-control-expose-headers"]
    # The traceback is logged with the request id, so the id in the client's error chip finds it.
    logged = [record for record in caplog.records if body["requestId"] in record.getMessage()]
    assert logged and logged[0].exc_info is not None


# ---- the current learner and the request context ----


def test_requests_act_as_the_default_learner(api: TestClient, db: Session) -> None:
    alex_id, _ = add_people(db)
    response = api.get(f"{API_V1_PREFIX}/probe/me")
    assert response.status_code == 200
    # Noon UTC is 17:30 in Kolkata: still the 8th there.
    assert response.json() == {"userId": alex_id, "today": "2026-10-08"}
    assert response.headers["x-server-time"] == "2026-10-08T12:00:00Z"


def test_the_user_header_selects_another_learner_but_never_a_bot(api: TestClient, db: Session) -> None:
    alex_id, bot_id = add_people(db)
    assert (
        api.get(f"{API_V1_PREFIX}/probe/me", headers={"X-User-Id": str(alex_id)}).json()["userId"] == alex_id
    )
    assert_problem(
        api.get(f"{API_V1_PREFIX}/probe/me", headers={"X-User-Id": str(bot_id)}), 403, "BOT_ACCOUNT"
    )
    for unknown in ("999", "abc", "9" * 40):
        assert_problem(api.get(f"{API_V1_PREFIX}/probe/me", headers={"X-User-Id": unknown}), 404, "NOT_FOUND")


def test_the_user_header_is_ignored_when_the_setting_is_off(api: TestClient, db: Session) -> None:
    alex_id, bot_id = add_people(db)
    use_settings(api, allow_user_header=False)
    response = api.get(f"{API_V1_PREFIX}/probe/me", headers={"X-User-Id": str(bot_id)})
    assert response.json()["userId"] == alex_id


def test_a_missing_default_learner_is_a_404_problem(api: TestClient) -> None:
    body = assert_problem(api.get(f"{API_V1_PREFIX}/probe/me"), 404, "NOT_FOUND")
    assert "alex" in body["detail"]


# ---- standard headers ----


def test_every_response_carries_the_same_boot_id(api: TestClient) -> None:
    health = api.get(f"{API_V1_PREFIX}/health")
    boot_id = health.json()["bootId"]
    assert re.fullmatch(r"[0-9a-f]{32}", boot_id)
    responses = [
        health,
        api.get(f"{API_V1_PREFIX}/nowhere"),
        api.post(f"{API_V1_PREFIX}/probe/goal", json={}),
        api.get(f"{API_V1_PREFIX}/probe/crash"),
    ]
    assert [response.headers["x-boot-id"] for response in responses] == [boot_id] * len(responses)


def test_a_valid_request_id_is_echoed_and_anything_else_replaced(api: TestClient) -> None:
    echoed = api.get(f"{API_V1_PREFIX}/nowhere", headers={"X-Request-ID": "trace-42.a"})
    assert echoed.headers["x-request-id"] == echoed.json()["requestId"] == "trace-42.a"
    for unusable in ("has spaces", "x" * 65):
        replaced = api.get(f"{API_V1_PREFIX}/health", headers={"X-Request-ID": unusable})
        assert HEX_ID.fullmatch(replaced.headers["x-request-id"])
    assert HEX_ID.fullmatch(api.get(f"{API_V1_PREFIX}/health").headers["x-request-id"])


def test_responses_are_not_cached_unless_the_route_says_so(api: TestClient) -> None:
    assert api.get(f"{API_V1_PREFIX}/health").headers["cache-control"] == "no-store"
    assert api.get(f"{API_V1_PREFIX}/nowhere").headers["cache-control"] == "no-store"
    assert api.get(f"{API_V1_PREFIX}/probe/cached").headers["cache-control"] == "public, max-age=300"


def test_server_time_is_sent_only_when_the_request_resolved_now(api: TestClient) -> None:
    health = api.get(f"{API_V1_PREFIX}/health")
    assert health.headers["x-server-time"] == health.json()["serverTime"] == "2026-10-08T12:00:00Z"
    assert "x-server-time" not in api.get(f"{API_V1_PREFIX}/nowhere").headers


# ---- GET /health ----


def test_health_reports_an_unseeded_database(api: TestClient) -> None:
    response = api.get(f"{API_V1_PREFIX}/health")
    body = response.json()
    assert response.status_code == 200
    assert set(body) == CONTRACT_KEYS["HealthOut"]
    assert (body["status"], body["seeded"], body["version"]) == (
        "ok",
        False,
        client_settings(api).app_version,
    )
    assert body["bootedAt"].endswith("Z")


def test_health_reports_seeding_and_the_demo_clock(api: TestClient, db: Session, clock: FrozenClock) -> None:
    db.add(AppState(id=1, clock_offset_seconds=3600, seeded_at=FROZEN_NOW, seed_version="test"))
    db.commit()
    body = api.get(f"{API_V1_PREFIX}/health").json()
    assert body["seeded"] is True
    assert body["serverTime"] == "2026-10-08T13:00:00Z"  # real time plus the one-hour offset
    clock.advance(minutes=30)
    assert api.get(f"{API_V1_PREFIX}/health").json()["serverTime"] == "2026-10-08T13:30:00Z"


# ---- OpenAPI ----


@pytest.fixture
def openapi(bare_client: TestClient) -> dict[str, Any]:
    """The OpenAPI document of the app as deployed (without the probe routes)."""
    response = bare_client.get(f"{API_V1_PREFIX}/openapi.json")
    assert response.status_code == 200
    schema: dict[str, Any] = response.json()
    return schema


def operations(schema: dict[str, Any]) -> Iterator[tuple[str, dict[str, Any]]]:
    for path, item in schema["paths"].items():
        for method, operation in item.items():
            yield f"{method.upper()} {path}", operation


def test_every_operation_has_a_stable_id_and_a_tag(openapi: dict[str, Any]) -> None:
    ids = {name: operation.get("operationId", "") for name, operation in operations(openapi)}
    assert ids["GET /api/v1/health"] == "getHealth"
    assert all(re.fullmatch(r"[a-z][A-Za-z]+", operation_id) for operation_id in ids.values()), ids
    assert all(operation.get("tags") for _, operation in operations(openapi))


def test_error_responses_are_documented_as_problem_details(openapi: dict[str, Any]) -> None:
    for name, operation in operations(openapi):
        for status, response in operation["responses"].items():
            if status.startswith(("4", "5")):
                assert set(response["content"]) == {PROBLEM_JSON}, name
                assert response["content"][PROBLEM_JSON]["schema"] == {
                    "$ref": "#/components/schemas/ProblemDetails"
                }
    assert "HTTPValidationError" not in openapi["components"]["schemas"]


def test_routes_list_their_problem_statuses_with_the_problem_schema() -> None:
    assert problem_responses(404, 409) == {
        404: {"model": ProblemDetails, "description": "Not Found"},
        409: {"model": ProblemDetails, "description": "Conflict"},
    }


def test_the_interactive_docs_are_served(bare_client: TestClient) -> None:
    response = bare_client.get(f"{API_V1_PREFIX}/docs")
    assert response.status_code == 200
    assert "swagger" in response.text.lower()


def test_the_api_serves_exactly_the_documented_endpoints(openapi: dict[str, Any]) -> None:
    served = {
        (method.upper(), path.removeprefix(API_V1_PREFIX)): operation["operationId"]
        for path, item in openapi["paths"].items()
        for method, operation in item.items()
    }
    assert served == {(method, path): operation for operation, (method, path, _) in ENDPOINTS.items()}
    for operation, (method, path, answer_type) in ENDPOINTS.items():
        responses = openapi["paths"][API_V1_PREFIX + path][method.lower()]["responses"]
        successes = [response for status, response in responses.items() if status.startswith("2")]
        assert successes, operation
        for response in successes:  # 201 Created and the 200 replay of a creation alike
            schema = response["content"]["application/json"]["schema"]
            assert schema == {"$ref": f"#/components/schemas/{answer_type}"}, operation


# ---- every endpoint, end to end ----

# An ISO-8601 instant in UTC as the contract writes it: whole seconds, or milliseconds, then "Z".
UTC_INSTANT = re.compile(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z")
LOOKS_LIKE_AN_INSTANT = re.compile(r"\d{4}-\d{2}-\d{2}T")
LOCAL_INSTANTS = frozenset({"localNow"})  # the only instant the contract writes with a UTC offset


def shape_problems(value: object, kind: str, where: str, seen: set[str]) -> list[str]:
    """How `value` differs from the contract type `kind` ("X", "X[]" or a union), nested objects
    included. Every object type met is added to `seen`."""
    if kind.endswith("[]"):
        if not isinstance(value, list):
            return [f"{where}: expected an array of {kind[:-2]}"]
        return [
            problem
            for index, item in enumerate(value)
            for problem in shape_problems(item, kind[:-2], f"{where}[{index}]", seen)
        ]
    if not isinstance(value, dict):
        return [f"{where}: expected a {kind} object"]
    if kind in DISCRIMINATED_UNIONS:
        member = DISCRIMINATED_UNIONS[kind].get(value.get("type"))
        if member is None:
            return [f"{where}: {value.get('type')!r} is not a type of {kind}"]
        kind = member
    seen.add(kind)
    problems = []
    keys, expected = set(value), CONTRACT_KEYS[kind]
    if keys != expected:
        problems.append(
            f"{where} ({kind}): missing {sorted(expected - keys)}, unexpected {sorted(keys - expected)}"
        )
    for name, child_kind in OBJECT_FIELDS.get(kind, {}).items():
        if value.get(name) is not None:
            problems += shape_problems(value[name], child_kind, f"{where}.{name}", seen)
    return problems


def instant_problems(value: object, where: str) -> list[str]:
    """Every instant in `value` that is not written in UTC with a "Z" (localNow excepted)."""
    if isinstance(value, list):
        return [
            problem
            for index, item in enumerate(value)
            for problem in instant_problems(item, f"{where}[{index}]")
        ]
    if not isinstance(value, dict):
        return []
    problems = []
    for name, item in value.items():
        if isinstance(item, str) and LOOKS_LIKE_AN_INSTANT.match(item):
            if name not in LOCAL_INSTANTS and not UTC_INSTANT.fullmatch(item):
                problems.append(f"{where}.{name}: {item!r} is not a UTC instant ending in Z")
        else:
            problems += instant_problems(item, f"{where}.{name}")
    return problems


def test_the_shape_check_names_every_difference() -> None:
    seen: set[str] = set()
    broken = json.loads(json.dumps(ME_EXAMPLE))
    del broken["gems"]
    broken["xp"]["week"] = broken["xp"].pop("thisWeek")
    broken["pendingLeagueResult"]["newLeague"]["icon"] = "silver"
    assert shape_problems(broken, "MeOut", "me", seen) == [
        "me (MeOut): missing ['gems'], unexpected []",
        "me.xp (MeXp): missing ['thisWeek'], unexpected ['week']",
        "me.pendingLeagueResult.newLeague (LeagueBrief): missing [], unexpected ['icon']",
    ]
    assert {"MeOut", "MeXp", "LeagueResultOut", "LeagueBrief", "DevInfo"} <= seen
    times = {"a": {"at": "2026-10-08T12:00:00+00:00"}, "localNow": "2026-10-08T17:30:00+05:30"}
    assert instant_problems(times, "x") == [
        "x.a.at: '2026-10-08T12:00:00+00:00' is not a UTC instant ending in Z"
    ]


@dataclass
class EndpointTour:
    """Calls endpoints by operation id and checks every answer against the contract, recording which
    operations were called and which object types their answers contained."""

    client: TestClient
    operations: set[str] = field(default_factory=set)
    types_seen: set[str] = field(default_factory=set)

    def call(
        self,
        operation: str,
        *,
        expect: int = 200,
        body: dict[str, Any] | None = None,
        headers: dict[str, str] | None = None,
        **path_params: object,
    ) -> dict[str, Any]:
        """Call one endpoint, assert its status, and check its answer's keys (nested) and instants."""
        method, path, answer_type = ENDPOINTS[operation]
        url = API_V1_PREFIX + path.format(**path_params)
        response = self.client.request(method, url, json=body, headers=headers)
        assert response.status_code == expect, f"{operation}: {response.status_code} {response.text}"
        assert response.headers["content-type"] == "application/json", operation
        answer: dict[str, Any] = response.json()
        problems = shape_problems(answer, answer_type, operation, self.types_seen)
        problems += instant_problems(answer, operation)
        assert problems == [], "\n".join(problems)
        self.operations.add(operation)
        return answer

    def play(
        self, engine: Engine, start: dict[str, Any], *, wrong: frozenset[int] = frozenset()
    ) -> dict[str, Any]:
        """Start a session, answer every item (initial items whose seq is in `wrong` wrongly first),
        then complete it; returns the receipt."""
        session = self.call("startSession", expect=201, body=start)
        items = {item["id"]: item for item in session["items"]}
        exercises = load_exercises(engine, (item["exercise"]["id"] for item in items.values()))
        current = session["currentItemId"]
        while current is not None:
            item = items[current]
            miss = item["origin"] == "initial" and item["seq"] in wrong
            payload = answer_for(exercises[item["exercise"]["id"]], correct=not miss)
            result = self.call("submitAnswer", body=payload, session_id=session["id"], item_id=current)
            if result["appendedItem"] is not None:
                items[result["appendedItem"]["id"]] = result["appendedItem"]
            current = result["session"]["currentItemId"]
        return self.call("completeSession", session_id=session["id"])


def tour_the_learners_pages(tour: EndpointTour) -> dict[str, Any]:
    """The shell, settings, history, path, quests, content, league and profiles; returns the path."""
    tour.call("getHealth")
    me = tour.call("getMe")  # last week's promotion is still to be shown
    tour.call("getSettings")
    tour.call("updateSettings", body={"soundEffects": False})
    tour.call("getActivity")
    path = tour.call("getPath")
    tour.call("getQuests")
    tour.call("listCourses")
    tour.call("getGuidebook", unit_id=path["units"][0]["id"])
    league = tour.call("getLeague")  # this week's rows and last week's result
    tour.call("getProfile", user_id="me")
    tour.call("getProfile", user_id=next(row["userId"] for row in league["rows"] if not row["isMe"]))
    tour.call("ackLeagueResult", membership_id=me["pendingLeagueResult"]["membershipId"])
    return path


def tour_the_shop(tour: EndpointTour) -> None:
    tour.call("listShopItems")
    key = {"Idempotency-Key": "4c7e1a0e-8f63-4e8b-9d55-0b6a2f7c1d90"}
    bought = tour.call("createPurchase", expect=201, body={"itemCode": "heart_refill"}, headers=key)
    tour.call("getPurchase", purchase_id=bought["id"])


def tour_the_lesson_loop(
    tour: EndpointTour, engine: Engine, path: dict[str, Any], clock: FrozenClock
) -> None:
    """Lessons, a chest, a legendary run that is quit, and a timed run that runs out of time."""
    drinks, chest = path["units"][1]["nodes"][1]["id"], path["units"][1]["nodes"][2]["id"]
    lesson = tour.call("startSession", expect=201, body={"kind": "lesson", "nodeId": drinks})
    assert tour.call("getMe")["activeSession"] is not None
    tour.call("getSession", session_id=lesson["id"])
    tour.call("quitSession", session_id=lesson["id"])
    first = tour.play(engine, {"kind": "lesson", "nodeId": drinks}, wrong=frozenset({1}))  # with a retry
    assert first["achievementsUnlocked"] and first["league"] and first["node"]
    second = tour.play(engine, {"kind": "lesson", "nodeId": drinks})
    assert second["questsCompleted"]
    tour.call("claimChest", node_id=chest)

    introduce_yourself = path["units"][0]["nodes"][1]["id"]
    legendary = tour.call(
        "startSession", expect=201, body={"kind": "legendary", "nodeId": introduce_yourself}
    )
    assert legendary["lives"] is not None
    tour.call("quitSession", session_id=legendary["id"])
    timed = tour.call("startSession", expect=201, body={"kind": "timed"})
    assert timed["timer"] is not None
    clock.advance(seconds=31)
    assert tour.call("completeSession", session_id=timed["id"])["timed"] is not None


def tour_the_dev_tools(tour: EndpointTour) -> None:
    tour.call("getDevClock")
    tour.call("advanceDevClock", body={"hours": 1})
    tour.call("devNextDay")
    assert tour.call("devNextWeek")["effects"]["leagueResults"]  # this week's league is finalized
    tour.call("patchDevLearner", body={"hearts": 3})
    tour.call("resetDemo")


def test_every_endpoint_answers_in_the_contract_shape(
    client: TestClient, clock: FrozenClock, seeded_engine: Engine
) -> None:
    tour = EndpointTour(client)
    path = tour_the_learners_pages(tour)
    tour_the_shop(tour)
    tour_the_lesson_loop(tour, seeded_engine, path, clock)
    tour_the_dev_tools(tour)

    assert tour.operations == set(ENDPOINTS)
    answer_types = set(CONTRACT_KEYS) - REQUEST_BODIES - {"CompletionReceipt", "ProblemDetails", "FieldError"}
    assert answer_types - tour.types_seen == set()  # every object type of every answer was met, filled in
