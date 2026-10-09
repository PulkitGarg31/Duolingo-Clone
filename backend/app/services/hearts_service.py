"""Hearts persistence: the token bucket stored in user_stats, moved only through the domain rules.

The count and its regeneration anchor are always written together, because a CHECK ties them and
SQLite checks it statement by statement.
"""

from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app.core import errors
from app.core.config import Settings
from app.domain import hearts
from app.domain.hearts import HeartsState
from app.domain.rules import MAX_HEARTS
from app.models import UserStats
from app.schemas.common import HeartsOut
from app.services import reference
from app.services.context import RequestContext


def regen_interval(settings: Settings) -> timedelta:
    """How long one heart takes to come back (configurable, so local demos can speed it up)."""
    return timedelta(minutes=settings.heart_regen_minutes)


def state_of(stats: UserStats) -> HeartsState:
    """The stored hearts as the domain rules see them."""
    return HeartsState(stats.hearts, stats.hearts_regen_anchor_at)


def regenerate(stats: UserStats, now: datetime, settings: Settings) -> int:
    """Add the hearts that came back since the anchor (the sync's second step); returns how many."""
    before = state_of(stats)
    after = hearts.regenerate(before, now, regen_interval(settings))
    if after != before:
        _store(stats, after, now)
    return after.hearts - before.hearts


def lose_one(ctx: RequestContext) -> None:
    """Spend a heart on a wrong answer or a skip in a lesson."""
    try:
        after = hearts.lose_one(state_of(ctx.stats), ctx.now, regen_interval(ctx.settings))
    except hearts.OutOfHearts as exc:
        raise errors.OutOfHearts(next_heart_at=exc.next_heart_at) from exc
    _store(ctx.stats, after, ctx.now)


def gain(ctx: RequestContext, count: int) -> int:
    """Add `count` hearts (the practice reward), never past the maximum; returns how many were added."""
    before = ctx.stats.hearts
    _store(ctx.stats, hearts.gain(state_of(ctx.stats), count, ctx.now, regen_interval(ctx.settings)), ctx.now)
    return ctx.stats.hearts - before


def refill(ctx: RequestContext) -> None:
    """Full hearts, as bought in the shop."""
    _store(ctx.stats, hearts.refill(), ctx.now)


def set_count(ctx: RequestContext, count: int) -> None:
    """Exactly `count` hearts with a fresh regeneration interval (demo tools)."""
    _store(ctx.stats, hearts.set_hearts(count, ctx.now), ctx.now)


def out_of_hearts(stats: UserStats, settings: Settings) -> errors.OutOfHearts:
    """The OUT_OF_HEARTS error, telling the learner when the next heart arrives."""
    return errors.OutOfHearts(next_heart_at=hearts.next_heart_at(state_of(stats), regen_interval(settings)))


def hearts_out(db: Session, stats: UserStats, settings: Settings) -> HeartsOut:
    """The hearts as the top bar shows them, with the countdowns and the refill price."""
    state, interval = state_of(stats), regen_interval(settings)
    return HeartsOut(
        current=state.hearts,
        max=MAX_HEARTS,
        next_heart_at=hearts.next_heart_at(state, interval),
        full_at=hearts.full_at(state, interval),
        regen_interval_seconds=int(interval.total_seconds()),
        refill_price_gems=reference.catalog(db).refill_price,
    )


def _store(stats: UserStats, state: HeartsState, now: datetime) -> None:
    stats.hearts, stats.hearts_regen_anchor_at = state.hearts, state.anchor
    stats.updated_at = now
