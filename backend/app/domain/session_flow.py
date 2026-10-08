"""How a session moves: its current item, what a wrong answer does, progress, combos and accuracy.

A session's queue holds one item per attempt, answered strictly in `seq` order; a missed exercise
can come back as a retry item appended at the end. What a mistake costs depends on the kind
(`rules_for`): a lesson spends a heart and re-asks until the exercise is right, practice re-asks
once, a legendary run fails at the third mistake and timed practice never re-asks.
"""

from collections import defaultdict
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum
from types import MappingProxyType
from typing import Final

from app.domain.enums import ItemLabel, ItemOrigin, ItemResult, RetryPolicy, SessionKind, SessionStatus
from app.domain.rules import LEGENDARY_MAX_MISTAKES, PRACTICE_MAX_RETRIES

WRONG: Final = frozenset({ItemResult.INCORRECT, ItemResult.SKIPPED})  # a skip counts as a mistake
# Right, or excused by "can't listen now"; can't-listen neither breaks nor extends a combo.
SETTLED: Final = frozenset({ItemResult.CORRECT, ItemResult.CANT_LISTEN})
GRADED: Final = frozenset({ItemResult.CORRECT, ItemResult.INCORRECT, ItemResult.SKIPPED})


class BlockedReason(StrEnum):
    """Why an active session can't take answers right now."""

    OUT_OF_HEARTS = "OUT_OF_HEARTS"


@dataclass(frozen=True)
class ItemFacts:
    """One attempt in a session's queue."""

    seq: int
    exercise_id: int
    origin: ItemOrigin = ItemOrigin.INITIAL
    result: ItemResult | None = None  # None until answered


@dataclass(frozen=True)
class SessionFacts:
    """The parts of a session that decide whether it may complete."""

    kind: SessionKind
    status: SessionStatus
    expires_at: datetime | None = None  # timed practice only: the moving deadline


@dataclass(frozen=True)
class SessionRules:
    """How a session kind treats mistakes; the client shows the same rules."""

    hearts_enabled: bool
    retry_policy: RetryPolicy
    hints_enabled: bool
    max_mistakes: int | None  # the run fails on the mistake after this many


@dataclass(frozen=True)
class Outcome:
    """What the service must do after a graded answer."""

    lose_heart: bool = False
    append_retry: bool = False
    fail: bool = False


@dataclass(frozen=True)
class Progress:
    """The player's progress bar: `completed` out of `total`."""

    completed: int
    total: int


@dataclass(frozen=True)
class Lives:
    """Legendary's lives, shown in place of hearts."""

    max: int
    left: int


# Columns: hearts enabled, retry policy, hints enabled, mistake limit.
_RULES: Final[Mapping[SessionKind, SessionRules]] = MappingProxyType(
    {
        SessionKind.LESSON: SessionRules(True, RetryPolicy.ALWAYS, True, None),
        SessionKind.PRACTICE: SessionRules(False, RetryPolicy.ONCE, True, None),
        SessionKind.LEGENDARY: SessionRules(False, RetryPolicy.NEVER, False, LEGENDARY_MAX_MISTAKES),
        SessionKind.TIMED: SessionRules(False, RetryPolicy.NEVER, True, None),
    }
)


def rules_for(kind: SessionKind) -> SessionRules:
    """Hearts only in lessons; retries always, once or never; no hints and three lives in legendary."""
    return _RULES[kind]


def current_item(items: Sequence[ItemFacts]) -> ItemFacts | None:
    """The unanswered item with the lowest seq, or None when nothing is left to answer."""
    return min((item for item in items if item.result is None), key=lambda item: item.seq, default=None)


def mistakes(items: Sequence[ItemFacts]) -> int:
    """Wrong answers and skips, retries included."""
    return sum(1 for item in items if item.result in WRONG)


def correct_count(items: Sequence[ItemFacts]) -> int:
    """Right answers, retries included."""
    return sum(1 for item in items if item.result == ItemResult.CORRECT)


def answered_count(items: Sequence[ItemFacts]) -> int:
    """Items with any result (timed practice reports "12 correct of 15 answered")."""
    return sum(1 for item in items if item.result is not None)


def initial_count(items: Sequence[ItemFacts]) -> int:
    """The items planned when the session started; retries are not counted."""
    return sum(1 for item in items if item.origin == ItemOrigin.INITIAL)


def retries_of(items: Sequence[ItemFacts], exercise_id: int) -> int:
    """How many times the exercise has already been re-queued."""
    return sum(1 for item in items if item.exercise_id == exercise_id and item.origin == ItemOrigin.RETRY)


def combo(items: Sequence[ItemFacts]) -> int:
    """The current run of right answers (the "IN A ROW" label)."""
    runs = _runs(items)
    return runs[-1] if runs else 0


def best_combo(items: Sequence[ItemFacts]) -> int:
    """The longest run of right answers in the session, retries included; it sizes the combo bonus."""
    return max(_runs(items), default=0)


def _runs(items: Sequence[ItemFacts]) -> list[int]:
    """The length of the running streak of right answers after each graded answer, in seq order."""
    runs: list[int] = []
    run = 0
    for item in sorted(items, key=lambda item: item.seq):
        if item.result == ItemResult.CORRECT:
            run += 1
        elif item.result in WRONG:
            run = 0
        else:
            continue  # unanswered, or can't-listen: it neither breaks nor extends the run
        runs.append(run)
    return runs


def decide(
    kind: SessionKind, item: ItemFacts, result: ItemResult, items_before: Sequence[ItemFacts]
) -> Outcome:
    """What a just-graded answer does, following the kind's rules.

    A right or can't-listen answer changes nothing. A wrong answer or a skip:
    - costs a heart where hearts are enabled (lessons);
    - comes back at the end of the queue: always, once per exercise, or never (the retry policy);
    - fails the run once mistakes go past the limit (legendary: the third mistake).
    `items_before` is the queue before this answer was recorded.
    """
    if result not in WRONG:
        return Outcome()
    rules = rules_for(kind)
    if rules.retry_policy == RetryPolicy.ALWAYS:
        retry = True
    elif rules.retry_policy == RetryPolicy.ONCE:
        retry = retries_of(items_before, item.exercise_id) < PRACTICE_MAX_RETRIES
    else:
        retry = False
    over_limit = rules.max_mistakes is not None and mistakes(items_before) + 1 > rules.max_mistakes
    return Outcome(lose_heart=rules.hearts_enabled, append_retry=retry, fail=over_limit)


def progress(kind: SessionKind, items: Sequence[ItemFacts]) -> Progress:
    """Resolved exercises out of the planned ones; timed practice counts right answers instead.

    An exercise is resolved once any attempt at it is right (or excused by can't-listen). Kinds that
    stop re-asking (practice, legendary) also let it go once every attempt at it is answered. So in a
    lesson the bar moves only on right answers, and never moves backwards.
    """
    total = initial_count(items)
    if kind == SessionKind.TIMED:
        return Progress(correct_count(items), total)
    attempts: defaultdict[int, list[ItemFacts]] = defaultdict(list)
    for item in items:
        attempts[item.exercise_id].append(item)
    gives_up = rules_for(kind).retry_policy != RetryPolicy.ALWAYS
    resolved = sum(
        1
        for item in items
        if item.origin == ItemOrigin.INITIAL and _is_resolved(attempts[item.exercise_id], gives_up)
    )
    return Progress(resolved, total)


def _is_resolved(attempts: Sequence[ItemFacts], gives_up: bool) -> bool:
    if any(attempt.result in SETTLED for attempt in attempts):
        return True
    return gives_up and all(attempt.result is not None for attempt in attempts)


def accuracy_percent(items: Sequence[ItemFacts]) -> int:
    """Right answers out of graded answers (can't-listen is not graded), rounded half up; 100 if none."""
    graded = sum(1 for item in items if item.result in GRADED)
    if graded == 0:
        return 100
    # floor(100 * right / graded + 1/2) in integers: halves round up, and no float error creeps in.
    return (200 * correct_count(items) + graded) // (2 * graded)


def lives(kind: SessionKind, items: Sequence[ItemFacts]) -> Lives | None:
    """One life per allowed mistake plus the last one (legendary: 3); None for kinds without lives."""
    limit = rules_for(kind).max_mistakes
    if limit is None:
        return None
    return Lives(max=limit + 1, left=max(0, limit + 1 - mistakes(items)))


def blocked_reason(kind: SessionKind, hearts: int) -> BlockedReason | None:
    """A lesson at 0 hearts is blocked, not ended: a refill or a regenerated heart lets it continue."""
    if rules_for(kind).hearts_enabled and hearts == 0:
        return BlockedReason.OUT_OF_HEARTS
    return None


def can_complete(session: SessionFacts, items: Sequence[ItemFacts], hearts: int, now: datetime) -> bool:
    """An active, unblocked session completes once nothing is left to answer, or (timed) at time-up."""
    if session.status != SessionStatus.ACTIVE or blocked_reason(session.kind, hearts) is not None:
        return False
    if session.kind == SessionKind.TIMED and session.expires_at is not None and now >= session.expires_at:
        return True  # time-up is a normal end in timed practice, never a failure
    return current_item(items) is None


def item_label(
    kind: SessionKind, origin: ItemOrigin, *, from_mistakes: bool, is_new_word: bool
) -> ItemLabel | None:
    """The badge above an exercise in the player.

    PREVIOUS MISTAKE on retries and on practice items picked from recent mistakes, NEW WORD on a
    lesson's new-word exercise, otherwise none.
    """
    if origin == ItemOrigin.RETRY or from_mistakes:
        return ItemLabel.PREVIOUS_MISTAKE
    if kind == SessionKind.LESSON and is_new_word:
        return ItemLabel.NEW_WORD
    return None
