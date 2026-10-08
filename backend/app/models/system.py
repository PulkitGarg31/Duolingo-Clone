"""Global application state, kept in a single row."""

from __future__ import annotations

from datetime import datetime

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class AppState(Base):
    """The one row of global state: the simulated clock's offset and the seed bookkeeping.

    Simulated time is real UTC plus `clock_offset_seconds`. The offset only ever grows, so rows
    written earlier can never end up in the future; resetting the demo is the only way back to 0.
    """

    __tablename__ = "app_state"

    id: Mapped[int] = mapped_column(primary_key=True)  # always 1
    clock_offset_seconds: Mapped[int] = mapped_column(server_default=sa.text("0"))
    seeded_at: Mapped[datetime]  # real UTC instant of the last (re)seed of learner data
    seed_version: Mapped[str] = mapped_column(sa.String(64))  # sha256 of the seed files

    __table_args__ = (
        sa.CheckConstraint("id = 1", name="single_row"),
        sa.CheckConstraint("clock_offset_seconds >= 0", name="offset_forward_only"),
    )
