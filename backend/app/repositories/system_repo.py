"""The single app_state row: the demo clock's offset and the seed bookkeeping."""

from datetime import datetime

from sqlalchemy import update
from sqlalchemy.orm import Session

from app.models import AppState

APP_STATE_ID = 1  # the table holds exactly one row (CHECK id = 1)


def get_state(db: Session) -> AppState | None:
    """The app_state row, or None before the database has been seeded."""
    return db.get(AppState, APP_STATE_ID)


def offset_seconds(db: Session) -> int:
    """How far the demo clock runs ahead of real time; 0 before seeding."""
    state = get_state(db)
    return 0 if state is None else state.clock_offset_seconds


def advance_offset(db: Session, seconds: int) -> None:
    """Move the demo clock forward. Time never goes back, so a negative step is refused."""
    if seconds < 0:
        raise ValueError(f"the clock only moves forward, got {seconds} s")
    db.execute(
        update(AppState)
        .where(AppState.id == APP_STATE_ID)
        .values(clock_offset_seconds=AppState.clock_offset_seconds + seconds)
    )


def mark_reseeded(db: Session, *, seeded_at: datetime) -> None:
    """Record that the learner data was re-seeded at `seeded_at`, and put the clock back on real time.

    This is the demo reset: the only way the offset ever returns to 0.
    """
    db.execute(
        update(AppState)
        .where(AppState.id == APP_STATE_ID)
        .values(clock_offset_seconds=0, seeded_at=seeded_at)
    )
