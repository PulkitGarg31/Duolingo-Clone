"""Bring a learner's state up to the request's `now` before the request is handled.

Nothing runs in the background: every request first catches up on the time that passed since the
last one, in this order:
1. finalize league weeks that have ended (global), so new XP joins the right tier;
2. regenerate hearts, which may unblock a lesson stopped at 0 hearts;
3. settle the streak: freezes cover missed days, or the streak is lost;
4. expire a session left idle for two hours.
Each step is idempotent and depends only on `now`, which is why GET requests may run it, and why a
server that slept for hours catches up exactly on its first request.
"""

from dataclasses import dataclass
from datetime import datetime

from sqlalchemy.orm import Session

from app.core.config import Settings
from app.domain.calendar import local_date
from app.models import User
from app.schemas.league import LeagueResultOut
from app.services import hearts_service, league_service, session_service, streak_service
from app.services.streak_service import SettleOutcome


@dataclass(frozen=True)
class SyncEffects:
    """What catching up to `now` changed for the learner."""

    hearts_gained: int
    streak: SettleOutcome
    league_results: list[LeagueResultOut]  # the learner's league weeks finalized by this catch-up
    sessions_expired: int


def bring_to_now(db: Session, user: User, now: datetime, settings: Settings) -> SyncEffects:
    """Catch the learner's state up to `now` and report what changed. The caller commits."""
    stats = user.stats
    if stats is None:  # bots are refused before any sync; every learner has stats
        raise RuntimeError(f"learner {user.id} has no stats row")
    finalized = league_service.finalize_due(db, now)
    hearts_gained = hearts_service.regenerate(stats, now, settings)
    streak = streak_service.settle(db, stats, local_date(now, user.timezone), now)
    expired = session_service.expire_stale(db, user.id, now)
    return SyncEffects(
        hearts_gained=hearts_gained,
        streak=streak,
        league_results=[league_service.result_out(db, m) for m in finalized if m.user_id == user.id],
        sessions_expired=expired,
    )
