"""The wire contract: every schema has exactly the keys the frontend expects (cross-checked
against the frontend's own copy), and every value is written in the agreed JSON format.
"""

import importlib
import json
import pkgutil
import re
from collections.abc import Iterator
from datetime import UTC, date, datetime, timedelta
from enum import Enum
from pathlib import Path
from typing import Any, get_args
from zoneinfo import ZoneInfo

import pytest

import app.schemas
from app.core.errors import (
    ErrorCode,
)
from app.domain import enums
from app.domain.enums import SessionKind, XpReason
from app.domain.rules import DAILY_GOAL_OPTIONS
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
from app.schemas.exercises import ExerciseOut
from app.schemas.me import MeOut
from app.schemas.quests import QuestSlot
from app.schemas.sessions import AnswerIn, BlockedReason, SessionOut, TimerOut
from app.schemas.shop import ShopUnavailableReason
from tests.api.contract_keys import (
    CONTRACT_KEYS,
    DISCRIMINATED_UNIONS,
    ENDPOINTS,
    INLINE_OBJECT_KEYS,
    INTERFACE_KEYS,
    ME_EXAMPLE,
    OBJECT_FIELDS,
    REQUEST_BODIES,
    UNION_VALUES,
)

FRONTEND_TYPES = Path(__file__).resolve().parents[3] / "frontend" / "src" / "lib" / "api" / "types.ts"

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
