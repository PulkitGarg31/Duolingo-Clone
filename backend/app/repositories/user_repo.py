"""Users, their stats and the league bots."""

from sqlalchemy import exists, select
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


def get_bot_profile(db: Session, user_id: int) -> BotProfile | None:
    return db.get(BotProfile, user_id)


def bot_ids(db: Session) -> list[int]:
    """Every bot's user id in ascending order: the pool cohorts draw their bots from."""
    return list(db.scalars(select(BotProfile.user_id).order_by(BotProfile.user_id)))
