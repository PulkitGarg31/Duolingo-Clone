"""Bring a learner's state up to the request's `now` before the request is handled.

The full catch-up finalizes ended league weeks, regenerates hearts, settles the streak (spending
freezes on missed days) and expires idle sessions, in that order. This placeholder version
changes nothing and reports no effects.
"""

from dataclasses import dataclass
from datetime import datetime

from sqlalchemy.orm import Session

from app.core.config import Settings
from app.models import User
from app.schemas.league import LeagueResultOut


@dataclass(frozen=True)
class SyncEffects:
    """What catching up to `now` changed for the learner."""

    hearts_gained: int
    streak_before: int
    streak_after: int
    freezes_used: int
    streak_lost: bool
    league_results: tuple[LeagueResultOut, ...]
    sessions_expired: int


def bring_to_now(db: Session, user: User, now: datetime, settings: Settings) -> SyncEffects:
    """Catch the learner's state up to `now` and report what changed."""
    streak = user.stats.streak_current if user.stats is not None else 0
    return SyncEffects(
        hearts_gained=0,
        streak_before=streak,
        streak_after=streak,
        freezes_used=0,
        streak_lost=False,
        league_results=(),
        sessions_expired=0,
    )
