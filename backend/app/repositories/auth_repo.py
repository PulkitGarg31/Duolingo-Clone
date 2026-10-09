"""Accounts and their sign-in sessions."""

from datetime import datetime

from sqlalchemy import exists, select
from sqlalchemy.orm import Session, joinedload

from app.models import AuthSession, User


def email_taken(db: Session, email: str) -> bool:
    """Whether an account already uses this (lowercased) email."""
    return bool(db.scalar(select(exists().where(User.email == email))))


def account_by_email(db: Session, email: str) -> User | None:
    """The account with this (lowercased) email; the demo learner and the bots have none."""
    return db.scalar(select(User).where(User.email == email))


def live_session(db: Session, token_hash: str, now: datetime) -> AuthSession | None:
    """The session of this token if it is neither revoked nor expired at `now`, with its user."""
    return db.scalar(
        select(AuthSession)
        .where(
            AuthSession.token_hash == token_hash,
            AuthSession.revoked_at.is_(None),
            AuthSession.expires_at > now,
        )
        .options(joinedload(AuthSession.user))
    )


def unrevoked_session(db: Session, token_hash: str) -> AuthSession | None:
    """The session of this token unless it was already revoked (an expired one still counts)."""
    return db.scalar(
        select(AuthSession).where(AuthSession.token_hash == token_hash, AuthSession.revoked_at.is_(None))
    )
