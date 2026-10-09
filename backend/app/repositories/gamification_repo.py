"""Catalogues and the learner facts that point at them: achievements, daily quests, the shop."""

from datetime import date, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models import Achievement, Quest, QuestClaim, ShopItem, UserAchievement

# ---- achievements ----


def achievements(db: Session) -> list[Achievement]:
    """The achievement catalogue in display order, each with its tiers (by level)."""
    return list(
        db.scalars(
            select(Achievement).order_by(Achievement.position).options(selectinload(Achievement.tiers))
        )
    )


def unlocked_tiers(db: Session, user_id: int) -> dict[int, datetime]:
    """When the learner first reached each achievement tier they own, by tier id."""
    rows = db.execute(
        select(UserAchievement.achievement_tier_id, UserAchievement.unlocked_at).where(
            UserAchievement.user_id == user_id
        )
    )
    return {tier_id: unlocked_at for tier_id, unlocked_at in rows}


# ---- daily quests ----


def quests(db: Session) -> list[Quest]:
    """The daily quest catalogue in display order."""
    return list(db.scalars(select(Quest).order_by(Quest.position)))


def claimed_quest_ids(db: Session, user_id: int, day: date) -> set[int]:
    """Quests whose reward the learner already received on this local day."""
    return set(
        db.scalars(
            select(QuestClaim.quest_id).where(QuestClaim.user_id == user_id, QuestClaim.local_date == day)
        )
    )


# ---- shop ----


def shop_items(db: Session) -> list[ShopItem]:
    """The shop catalogue in display order, including items that are coming soon."""
    return list(db.scalars(select(ShopItem).order_by(ShopItem.position)))
