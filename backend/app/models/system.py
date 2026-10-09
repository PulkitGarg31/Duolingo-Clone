"""Global application state, kept in a single row."""

from __future__ import annotations

from datetime import datetime

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class AppState(Base):
    """The one row of global state: the seed bookkeeping.

    Simulated time is per learner (`users.clock_offset_seconds`), so nothing about the clock is global.
    """

    __tablename__ = "app_state"

    id: Mapped[int] = mapped_column(primary_key=True)  # always 1
    seeded_at: Mapped[datetime]  # real UTC instant of the last (re)seed of the shared demo learner's history
    seed_version: Mapped[str] = mapped_column(sa.String(64))  # sha256 of the seed files

    __table_args__ = (sa.CheckConstraint("id = 1", name="single_row"),)
