"""Streak persistence: user_stats.streak_* and the activity_days calendar behind it.

`settle` runs in every request's sync (missed days use freezes or end the streak); `credit` runs
after a session that earned XP and records today as an active day with the goal in force.
"""

import itertools
from dataclasses import dataclass
from datetime import date, datetime, timedelta

from sqlalchemy.orm import Session

from app.domain import streak
from app.domain.enums import ActivityKind, DayState
from app.domain.streak import StreakState
from app.models import UserStats
from app.repositories import ledger_repo
from app.schemas.completion import StreakDayOut
from app.services.context import RequestContext

WEEK_DAYS = 7  # the streak strip on the completion screen shows the last seven local days


@dataclass(frozen=True)
class SettleOutcome:
    """What settling the streak did: its length before and after, freezes spent, and whether it was lost."""

    before: int
    after: int
    freezes_used: int
    lost: bool


def state_of(stats: UserStats) -> StreakState:
    """The stored streak as the domain rules see it."""
    return StreakState(
        stats.streak_current, stats.streak_longest, stats.streak_last_date, stats.streak_freezes
    )


def settle(db: Session, stats: UserStats, today: date, now: datetime) -> SettleOutcome:
    """Apply the local days that ended without a session: one equipped freeze per missed day, oldest
    first, and the streak is lost once they run out. Frozen days are recorded in the calendar."""
    before = state_of(stats)
    result = streak.settle(before, today)
    if result.state != before:
        _store(stats, result.state, now)
    ledger_repo.mark_frozen_days(db, stats.user_id, result.frozen_dates, now=now)
    return SettleOutcome(before.current, result.state.current, len(result.frozen_dates), result.lost)


def credit(db: Session, ctx: RequestContext) -> bool:
    """Count today after a session that earned XP; True when this session is what extended the streak.

    Today's calendar row becomes active with the daily goal in force, even when the streak was
    already extended earlier today.
    """
    after, extended = streak.credit(state_of(ctx.stats), ctx.today)
    if extended:
        _store(ctx.stats, after, ctx.now)
    ledger_repo.mark_active_day(
        db, ctx.user.id, ctx.today, goal_xp=ctx.preferences.daily_goal_xp, now=ctx.now
    )
    return extended


def shift_for_timezone(ctx: RequestContext, new_timezone: str) -> None:
    """Move the last covered day along with a change of time zone, so the gap to today is unchanged
    and the change neither breaks nor inflates the streak."""
    before = state_of(ctx.stats)
    after = streak.shift_for_timezone(before, ctx.now, ctx.user.timezone, new_timezone)
    if after != before:
        _store(ctx.stats, after, ctx.now)


def week(db: Session, user_id: int, today: date) -> list[StreakDayOut]:
    """The last seven local days ending today, each active, frozen or none."""
    first = today - timedelta(days=WEEK_DAYS - 1)
    kinds = {row.local_date: row.kind for row in ledger_repo.activity_days_between(db, user_id, first, today)}
    return [
        StreakDayOut(date=day, state=_day_state(kinds.get(day)))
        for day in (first + timedelta(days=n) for n in range(WEEK_DAYS))
    ]


def frozen_yesterday(db: Session, user_id: int, today: date) -> bool:
    """Whether a Streak Freeze covered yesterday (the streak popover's blue heading)."""
    row = ledger_repo.activity_day(db, user_id, today - timedelta(days=1))
    return row is not None and row.kind == ActivityKind.FROZEN


def next_milestone(current: int) -> int:
    """The next streak length worth a celebration, above `current`."""
    return next(n for n in itertools.count(current + 1) if streak.is_milestone(n))


def _day_state(kind: ActivityKind | None) -> DayState:
    return DayState.NONE if kind is None else DayState(kind.value)


def _store(stats: UserStats, state: StreakState, now: datetime) -> None:
    stats.streak_current, stats.streak_longest = state.current, state.longest
    stats.streak_last_date, stats.streak_freezes = state.last_date, state.freezes
    stats.updated_at = now
