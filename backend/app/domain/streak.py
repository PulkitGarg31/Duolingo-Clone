"""The daily streak, counted in the learner's local calendar days.

A streak day is a local date on which the learner finished a session that earned XP. Days are
compared as dates, never as "24 hours since", so a 23- or 25-hour DST day is still one day.
Each fully missed day uses one equipped Streak Freeze, oldest first; when they run out, the
streak is lost. `settle` runs on every request, and `credit` after every session that earns XP.
"""

from dataclasses import dataclass, replace
from datetime import date, datetime, timedelta
from typing import Final

from app.domain.calendar import local_date
from app.domain.enums import StreakStatus
from app.domain.rules import MAX_STREAK_FREEZES, STREAK_MILESTONES

ONE_DAY: Final = timedelta(days=1)
LATE_MILESTONE_EVERY: Final = 100  # past the last listed milestone, every multiple of this is one


@dataclass(frozen=True)
class StreakState:
    """The stored streak: its length, the record, the last covered day and the equipped freezes."""

    current: int
    longest: int  # never decreases, so streak achievements are never taken back
    last_date: date | None  # the last local day covered, by activity or by a freeze
    freezes: int

    def __post_init__(self) -> None:
        if self.current < 0:
            raise ValueError(f"a streak can't be negative, got {self.current}")
        if (self.current == 0) != (self.last_date is None):
            raise ValueError("a streak has a last covered day exactly when it is alive")
        if self.longest < self.current:
            raise ValueError("the longest streak can't be shorter than the current streak")
        if not 0 <= self.freezes <= MAX_STREAK_FREEZES:
            raise ValueError(f"streak freezes must be between 0 and {MAX_STREAK_FREEZES}, got {self.freezes}")


@dataclass(frozen=True)
class SettleResult:
    """The settled streak, the days its freezes covered, and whether it was lost."""

    state: StreakState
    frozen_dates: tuple[date, ...]
    lost: bool


def settle(s: StreakState, today: date) -> SettleResult:
    """Apply the days that ended without activity, one freeze per missed day.

    Idempotent: afterwards the streak covers yesterday or is gone, so settling again the same day
    changes nothing.
    """
    yesterday = today - ONE_DAY
    if s.last_date is None or s.last_date >= yesterday:
        return SettleResult(s, (), lost=False)  # no streak, or no day missed yet
    missed = (yesterday - s.last_date).days  # whole past days without activity
    used = min(s.freezes, missed)
    frozen = tuple(s.last_date + n * ONE_DAY for n in range(1, used + 1))  # oldest first
    if used == missed:
        # Every missed day is covered: the streak survives, but frozen days do not lengthen it.
        return SettleResult(replace(s, last_date=yesterday, freezes=s.freezes - used), frozen, lost=False)
    return SettleResult(replace(s, current=0, last_date=None, freezes=s.freezes - used), frozen, lost=True)


def credit(s: StreakState, today: date) -> tuple[StreakState, bool]:
    """Count today after a session that earned XP: the new state, and whether today is newly counted.

    Call it on a settled streak: one that covers yesterday grows by one, anything else starts at 1.
    """
    if s.last_date is not None and s.last_date >= today:
        return s, False  # today is already covered (or the zone just moved west)
    current = s.current + 1 if s.last_date == today - ONE_DAY else 1
    return StreakState(current, max(s.longest, current), today, s.freezes), True


def status(s: StreakState, today: date) -> StreakStatus:
    """Whether a settled streak still needs a session today."""
    if s.last_date is None:
        return StreakStatus.INACTIVE
    # A streak covering today, or a later day right after a move west, needs nothing more today,
    # which is exactly when `credit` would change nothing.
    return StreakStatus.EXTENDED if s.last_date >= today else StreakStatus.AT_RISK


def is_milestone(n: int) -> bool:
    """Streak lengths that get a celebration: the listed ones, then every multiple of 100."""
    return n in STREAK_MILESTONES or (n > STREAK_MILESTONES[-1] and n % LATE_MILESTONE_EVERY == 0)


def shift_for_timezone(s: StreakState, now: datetime, old_tz: str, new_tz: str) -> StreakState:
    """Move the last covered day along with a change of time zone.

    The gap between that day and today stays the same, so the change neither breaks nor inflates
    the streak.
    """
    if s.last_date is None:
        return s
    shift = local_date(now, new_tz) - local_date(now, old_tz)  # usually -1, 0 or +1 day
    return replace(s, last_date=s.last_date + shift)
