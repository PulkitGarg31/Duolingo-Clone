"""Users, their stats, the guests and the league bots."""

from collections.abc import Sequence

from sqlalchemy import delete, exists, select
from sqlalchemy.orm import Session

from app.models import BotProfile, User, UserStats


def get(db: Session, user_id: int) -> User | None:
    return db.get(User, user_id)


def get_by_username(db: Session, username: str) -> User | None:
    return db.scalar(select(User).where(User.username == username))


def is_bot(db: Session, user_id: int) -> bool:
    """A bot is a user with a bot profile; there is no flag to keep in sync."""
    return bool(db.scalar(select(exists().where(BotProfile.user_id == user_id))))


def get_stats(db: Session, user_id: int) -> UserStats | None:
    """A learner's game counters (bots have none)."""
    return db.get(UserStats, user_id)


def bot_ids(db: Session) -> list[int]:
    """Every bot's user id in ascending order: the pool cohorts draw their bots from."""
    return list(db.scalars(select(BotProfile.user_id).order_by(BotProfile.user_id)))


def guest_ids_beyond(db: Session, keep: int) -> list[int]:
    """The ids of every guest except the newest `keep` (ids grow with creation), oldest first."""
    newest_first = select(User.id).where(User.is_guest).order_by(User.id.desc()).offset(keep)
    return sorted(db.scalars(newest_first))


def delete_users(db: Session, user_ids: Sequence[int]) -> None:
    """Delete these users. Every row of theirs goes with them: each points at its user, or at a row
    of theirs, with ON DELETE CASCADE (their cohorts take the bots' memberships in them too)."""
    if user_ids:
        statement = delete(User).where(User.id.in_(user_ids))
        db.execute(statement, execution_options={"synchronize_session": False})
