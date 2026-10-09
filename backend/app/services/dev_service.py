"""Demo tools: the learner's own clock, learner tweaks and the reset of the learner's data.

Every learner (account or guest) is a sandbox: simulated time is real time plus the learner's own
offset, which only ever grows, so rows written earlier can never end up in the future. A jump adds
to the caller's offset and then runs the same catch-up every request runs, at the new `now`;
resetting the caller's progress is the only way back to real time. No tool here touches another
learner.
"""

import math
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Final
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from app.domain.calendar import league_week_bounds, league_week_start, local_date, next_local_midnight
from app.models import User
from app.repositories import user_repo
from app.schemas.dev import (
    ClockAdvanceIn,
    ClockChangeOut,
    ClockOut,
    DevLearnerPatchIn,
    SyncEffectsOut,
    SyncStreakOut,
)
from app.seed.sample_learner import reset_demo, restart_account
from app.services import gems_service, hearts_service, sync_service
from app.services.context import RequestContext

# Jumps land a few seconds past their boundary, safely inside the new day or week even where a DST
# change makes local midnight ambiguous.
JUMP_MARGIN: Final = timedelta(seconds=5)


@dataclass(frozen=True)
class ClockJump:
    """The new simulated instant and what the jump changed."""

    now: datetime
    change: ClockChangeOut


@dataclass(frozen=True)
class DemoReset:
    """When the caller's data was rebuilt, and their request context after the reset."""

    seeded_at: datetime
    ctx: RequestContext


def clock(user: User, now: datetime) -> ClockOut:
    """The learner's clock at `now`: real time, their offset, and the simulated time in their zone."""
    offset = user.clock_offset_seconds
    week = league_week_start(now)
    return ClockOut(
        real_now=now - timedelta(seconds=offset),
        offset_seconds=offset,
        now=now,
        timezone=user.timezone,
        local_now=now.astimezone(ZoneInfo(user.timezone)).isoformat(timespec="seconds"),
        local_date=local_date(now, user.timezone),
        league_week_start=week,
        league_week_ends_at=league_week_bounds(week)[1],
    )


def advance(db: Session, ctx: RequestContext, request: ClockAdvanceIn) -> ClockJump:
    """Move time forward by the requested minutes, hours and days."""
    return _jump_to(db, ctx, ctx.now + request.delta)


def next_day(db: Session, ctx: RequestContext) -> ClockJump:
    """Jump just past the learner's next local midnight: the day without a session is now missed."""
    return _jump_to(db, ctx, next_local_midnight(ctx.now, ctx.user.timezone) + JUMP_MARGIN)


def next_week(db: Session, ctx: RequestContext) -> ClockJump:
    """Jump just past next Monday 00:00 UTC, which ends the league week."""
    return _jump_to(db, ctx, league_week_bounds(league_week_start(ctx.now))[1] + JUMP_MARGIN)


def patch_learner(db: Session, ctx: RequestContext, patch: DevLearnerPatchIn) -> None:
    """Set the learner's hearts and/or gems for a demo; gems still move through the gem ledger."""
    if patch.hearts is not None:
        hearts_service.set_count(ctx, patch.hearts)
    if patch.gems is not None:
        gems_service.set_balance(db, ctx.user.id, patch.gems, now=ctx.now)


def reset(db: Session, ctx: RequestContext) -> DemoReset:
    """Start the caller over and put their clock back on real time; nobody else is touched.

    A demo learner (the shared seeded learner or a guest) gets the sample history again, in their
    current time zone; an account starts over as a new account. Returns the caller's context at real
    time, read back after the reset.
    """
    real_now = ctx.now - timedelta(seconds=ctx.user.clock_offset_seconds)
    if ctx.is_demo:
        reset_demo(db, ctx.user.id, real_now, ctx.settings)
    else:
        restart_account(db, ctx.user.id, real_now)
    db.flush()
    db.expire_all()  # the reset rewrote rows with bulk statements: read them back from the database
    caller = user_repo.get(db, ctx.user.id)
    if caller is None or caller.stats is None:  # either reset gives the learner fresh stats
        raise RuntimeError(f"the reset left learner {ctx.user.id} without stats")
    after = RequestContext(
        user=caller,
        stats=caller.stats,
        now=real_now,
        today=local_date(real_now, caller.timezone),
        settings=ctx.settings,
    )
    return DemoReset(seeded_at=real_now, ctx=after)


def _jump_to(db: Session, ctx: RequestContext, target: datetime) -> ClockJump:
    """Add whole seconds to the learner's offset to reach `target`, then catch them up to it.

    Every jump lands after `now`, so the offset only grows (and the database refuses a negative one).
    """
    seconds = math.ceil((target - ctx.now).total_seconds())
    if seconds <= 0:
        raise ValueError(f"the clock only moves forward, got {seconds} s")
    ctx.user.clock_offset_seconds += seconds  # read under this request's write lock, so no update is lost
    new_now = ctx.now + timedelta(seconds=seconds)
    effects = sync_service.bring_to_now(db, ctx.user, new_now, ctx.settings)
    return ClockJump(
        now=new_now,
        change=ClockChangeOut(
            clock=clock(ctx.user, new_now),
            effects=SyncEffectsOut(
                hearts_gained=effects.hearts_gained,
                streak=SyncStreakOut(
                    before=effects.streak.before,
                    after=effects.streak.after,
                    freezes_used=effects.streak.freezes_used,
                    lost=effects.streak.lost,
                ),
                league_results=effects.league_results,
                sessions_expired=effects.sessions_expired,
            ),
        ),
    )
