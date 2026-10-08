"""Session start rules and the planners that fill a new session's queue.

`start_refusal` checks a start request before anything changes. The planners are pure: they take
plain descriptions of exercises and a generator seeded from the session's `rng_seed`, so a session
always gets the same items in the same order on every machine. Each planner returns the queue in
play order; only practice marks items picked from recent mistakes.
"""

import random
from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum
from typing import Final

from app.domain.enums import ExerciseType, NodeKind, NodeState, SessionKind
from app.domain.path import FINISHED_STATES, PLAYABLE_KINDS
from app.domain.rules import (
    LEGENDARY_ITEM_COUNT,
    LEGENDARY_PRICE_GEMS,
    MISTAKE_LOOKBACK,
    PRACTICE_ITEM_COUNT,
    PRACTICE_MISTAKE_SHARE,
    TIMED_BONUS_SECONDS,
    TIMED_ITEM_COUNT,
)

# Types where the learner produces the answer (type_answer includes "type what you hear").
PRODUCTIVE_TYPES: Final = frozenset(
    {ExerciseType.TYPE_ANSWER, ExerciseType.TRANSLATE, ExerciseType.FILL_BLANK}
)
# Timed practice uses the quick types only: exactly the ones that add time to the clock.
TIMED_TYPES: Final = frozenset(TIMED_BONUS_SECONDS)


class StartRefusal(StrEnum):
    """Why a session can't start. Each value is the API error code the service reports."""

    NODE_NOT_PLAYABLE = "NODE_NOT_PLAYABLE"
    NODE_LOCKED = "NODE_LOCKED"
    NODE_ALREADY_COMPLETED = "NODE_ALREADY_COMPLETED"
    ALREADY_LEGENDARY = "ALREADY_LEGENDARY"
    OUT_OF_HEARTS = "OUT_OF_HEARTS"
    INSUFFICIENT_GEMS = "INSUFFICIENT_GEMS"
    NOTHING_TO_PRACTICE = "NOTHING_TO_PRACTICE"


@dataclass(frozen=True)
class ExerciseFacts:
    """What the planners need to know about one exercise."""

    id: int
    type: ExerciseType
    audio_only: bool = False  # "type what you hear": left out while listening exercises are off


@dataclass(frozen=True)
class PlannedItem:
    """One initial item of a new session's queue."""

    exercise_id: int
    from_mistakes: bool = False  # practice picked it from recent mistakes (PREVIOUS MISTAKE label)


@dataclass(frozen=True)
class Mistake:
    """An exercise the learner answered wrong or skipped, and when."""

    exercise_id: int
    answered_at: datetime


def start_refusal(
    kind: SessionKind,
    node: tuple[NodeKind, NodeState] | None,
    *,
    hearts: int,
    gems: int,
    lessons_completed: int,
) -> StartRefusal | None:
    """Why a session of `kind` can't start now, or None when it can.

    `node` is the requested node's kind and state: required for lessons and legendary runs, optional
    for practice, absent for timed practice (the request schema enforces that shape). On a node the
    checks run in this order: its kind (a wrong kind is never playable that way), its state, then
    the learner's hearts (lessons) or gems (legendary). Practice is allowed at 0 hearts, since it is
    how hearts come back.
    """
    if node is None:
        if kind in (SessionKind.LESSON, SessionKind.LEGENDARY):
            raise ValueError(f"a {kind} session needs a node")
        # Global practice and timed practice draw from every lesson completed so far.
        return None if lessons_completed > 0 else StartRefusal.NOTHING_TO_PRACTICE
    node_kind, state = node
    match kind:
        case SessionKind.LESSON:
            if node_kind not in PLAYABLE_KINDS:
                return StartRefusal.NODE_NOT_PLAYABLE
            if state == NodeState.LOCKED:
                return StartRefusal.NODE_LOCKED
            if state != NodeState.ACTIVE:
                return StartRefusal.NODE_ALREADY_COMPLETED
            return StartRefusal.OUT_OF_HEARTS if hearts < 1 else None
        case SessionKind.PRACTICE:
            if node_kind not in PLAYABLE_KINDS:
                return StartRefusal.NODE_NOT_PLAYABLE
            if state == NodeState.LOCKED:
                return StartRefusal.NODE_LOCKED
            return None if state in FINISHED_STATES else StartRefusal.NODE_NOT_PLAYABLE
        case SessionKind.LEGENDARY:
            if node_kind != NodeKind.SKILL:
                return StartRefusal.NODE_NOT_PLAYABLE
            if state == NodeState.LOCKED:
                return StartRefusal.NODE_LOCKED
            if state == NodeState.LEGENDARY:
                return StartRefusal.ALREADY_LEGENDARY
            if state != NodeState.COMPLETED:
                return StartRefusal.NODE_NOT_PLAYABLE  # the skill is still in progress
            return StartRefusal.INSUFFICIENT_GEMS if gems < LEGENDARY_PRICE_GEMS else None
        case _:
            raise ValueError(f"a {kind} session never targets a node")


def plan_lesson(exercises_in_order: Iterable[ExerciseFacts], *, listening_enabled: bool) -> list[PlannedItem]:
    """The lesson's exercises in authored order, without listening ones while they are turned off.

    Which lesson is played (the node's next one) is decided by the caller.
    """
    return [PlannedItem(e.id) for e in exercises_in_order if _allowed(e, listening_enabled)]


def recent_mistake_ids(mistakes: Iterable[Mistake], now: datetime) -> list[int]:
    """Exercises missed or skipped within MISTAKE_LOOKBACK of `now`, most recent first, once each."""
    since = now - MISTAKE_LOOKBACK
    recent = [m for m in mistakes if m.answered_at >= since]
    recent.sort(key=lambda m: m.answered_at, reverse=True)
    return list(dict.fromkeys(m.exercise_id for m in recent))  # keeps the first, most recent, of each


def plan_practice(
    pool: Iterable[ExerciseFacts],
    recent_mistakes: Sequence[int],
    rng: random.Random,
    *,
    listening_enabled: bool,
) -> list[PlannedItem]:
    """Up to PRACTICE_ITEM_COUNT exercises from the pool, recent mistakes first.

    The pool is every exercise of the lessons completed so far: the node's for node practice, the
    whole course's for global practice. Up to PRACTICE_MISTAKE_SHARE of the learner's recent
    mistakes (`recent_mistake_ids`) come first, most recent first; a seeded shuffle of the rest
    fills the session.
    """
    available = {e.id for e in pool if _allowed(e, listening_enabled)}
    missed = [i for i in dict.fromkeys(recent_mistakes) if i in available][:PRACTICE_MISTAKE_SHARE]
    rest = sorted(available.difference(missed))  # sorted, so the order depends on the seed alone
    rng.shuffle(rest)
    fresh = rest[: PRACTICE_ITEM_COUNT - len(missed)]
    return [PlannedItem(i, from_mistakes=True) for i in missed] + [PlannedItem(i) for i in fresh]


def plan_legendary(
    node_exercises: Iterable[ExerciseFacts], rng: random.Random, *, listening_enabled: bool
) -> list[PlannedItem]:
    """Up to LEGENDARY_ITEM_COUNT of the node's exercises: productive types first, never match pairs.

    Typing, translating and filling blanks test recall, so they are picked first; multiple choice
    only fills the places left. The picks are then shuffled together. A node with fewer exercises
    simply gives a shorter run.
    """
    pool = [
        e for e in node_exercises if e.type != ExerciseType.MATCH_PAIRS and _allowed(e, listening_enabled)
    ]
    productive = sorted({e.id for e in pool if e.type in PRODUCTIVE_TYPES})
    choices = sorted({e.id for e in pool if e.type == ExerciseType.MULTIPLE_CHOICE})
    rng.shuffle(productive)
    rng.shuffle(choices)
    picked = (productive + choices)[:LEGENDARY_ITEM_COUNT]
    rng.shuffle(picked)
    return [PlannedItem(i) for i in picked]


def plan_timed(pool: Iterable[ExerciseFacts], rng: random.Random) -> list[PlannedItem]:
    """Up to TIMED_ITEM_COUNT quick exercises (no typing or listening), in a seeded random order."""
    quick = sorted({e.id for e in pool if e.type in TIMED_TYPES})
    rng.shuffle(quick)
    return [PlannedItem(i) for i in quick[:TIMED_ITEM_COUNT]]


def _allowed(exercise: ExerciseFacts, listening_enabled: bool) -> bool:
    """Listening exercises are left out while the learner has them turned off."""
    return listening_enabled or not exercise.audio_only
