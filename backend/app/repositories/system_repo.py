"""The single app_state row: the seed bookkeeping."""

from datetime import datetime

from sqlalchemy import update
from sqlalchemy.orm import Session

from app.models import AppState

APP_STATE_ID = 1  # the table holds exactly one row (CHECK id = 1)


def get_state(db: Session) -> AppState | None:
    """The app_state row, or None before the database has been seeded."""
    return db.get(AppState, APP_STATE_ID)


def mark_reseeded(db: Session, *, seeded_at: datetime) -> None:
    """Record that the shared demo learner's history was re-seeded at `seeded_at` (real time)."""
    db.execute(update(AppState).where(AppState.id == APP_STATE_ID).values(seeded_at=seeded_at))
