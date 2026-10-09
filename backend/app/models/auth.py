"""Sign-in sessions: one row per issued token, of which only the sha256 is stored."""

from __future__ import annotations

from datetime import datetime

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.users import User


class AuthSession(Base):
    """A token issued at signup or login. It is valid until it expires or its owner logs out.

    Its instants are real time, not the learner's simulated clock: time travel in the demo tools must
    never sign anyone out.
    """

    __tablename__ = "auth_sessions"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(sa.ForeignKey("users.id", ondelete="CASCADE"), index=True)
    token_hash: Mapped[str] = mapped_column(sa.CHAR(64))  # sha256 of the token, in hex
    created_at: Mapped[datetime]
    expires_at: Mapped[datetime]
    revoked_at: Mapped[datetime | None]  # set by logout

    user: Mapped[User] = relationship()

    __table_args__ = (
        sa.UniqueConstraint("token_hash"),
        sa.CheckConstraint("length(token_hash) = 64", name="token_hash_sha256"),
        sa.CheckConstraint("expires_at > created_at", name="expires_after_created"),
        sa.CheckConstraint("revoked_at IS NULL OR revoked_at >= created_at", name="revoked_after_created"),
    )
