"""Gamification catalogues and the learner facts that point at them: achievements, shop, quests."""

from __future__ import annotations

from datetime import date, datetime

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.types import checked_bool, str_enum
from app.domain.enums import AchievementMetric, QuestMetric, ShopItemKind, ShopSection
from app.models.base import Base


class Achievement(Base):
    """A profile badge such as Wildfire, measured by one learner metric across leveled tiers."""

    __tablename__ = "achievements"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(sa.String(24))  # 'wildfire'
    name: Mapped[str] = mapped_column(sa.String(40))
    description_template: Mapped[str] = mapped_column(sa.String(120))  # 'Reach a {n} day streak'
    metric: Mapped[AchievementMetric] = mapped_column(str_enum(AchievementMetric, "metric", 24))
    color: Mapped[str] = mapped_column(sa.CHAR(7))  # badge tile colour
    position: Mapped[int]

    tiers: Mapped[list[AchievementTier]] = relationship(
        back_populates="achievement",
        order_by="AchievementTier.level",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    __table_args__ = (
        sa.UniqueConstraint("code"),
        sa.UniqueConstraint("position"),
    )


class AchievementTier(Base):
    """One level of an achievement ("LEVEL 3") and the metric value that reaches it."""

    __tablename__ = "achievement_tiers"

    id: Mapped[int] = mapped_column(primary_key=True)
    achievement_id: Mapped[int] = mapped_column(sa.ForeignKey("achievements.id", ondelete="CASCADE"))
    level: Mapped[int]
    threshold: Mapped[int]
    description: Mapped[str | None] = mapped_column(sa.String(120))  # optional wording for this level

    achievement: Mapped[Achievement] = relationship(back_populates="tiers")

    __table_args__ = (
        sa.UniqueConstraint("achievement_id", "level"),
        sa.UniqueConstraint("achievement_id", "threshold"),
        sa.CheckConstraint("level >= 1", name="level_positive"),
        sa.CheckConstraint("threshold > 0", name="threshold_positive"),
    )


class UserAchievement(Base):
    """When a learner first reached an achievement level; drives the unlock celebration.

    The level itself is always recomputed from the metric, so this row only records the moment.
    """

    __tablename__ = "user_achievements"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(sa.ForeignKey("users.id", ondelete="CASCADE"))
    achievement_tier_id: Mapped[int] = mapped_column(
        sa.ForeignKey("achievement_tiers.id", ondelete="RESTRICT"), index=True
    )
    # The completion that unlocked it. Informational, so deleting the session only clears it.
    session_id: Mapped[int | None] = mapped_column(
        sa.ForeignKey("lesson_sessions.id", ondelete="SET NULL"), index=True
    )
    unlocked_at: Mapped[datetime]

    __table_args__ = (sa.UniqueConstraint("user_id", "achievement_tier_id"),)


class ShopItem(Base):
    """A shop catalogue entry, such as a heart refill or a Streak Freeze, with its gem price."""

    __tablename__ = "shop_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(sa.String(24))  # 'heart_refill'
    kind: Mapped[ShopItemKind] = mapped_column(str_enum(ShopItemKind, "kind", 16))
    section: Mapped[ShopSection] = mapped_column(str_enum(ShopSection, "section", 12))
    name: Mapped[str] = mapped_column(sa.String(40))
    description: Mapped[str] = mapped_column(sa.String(160))
    price_gems: Mapped[int]
    duration_minutes: Mapped[int | None]  # XP boosts only
    # False: listed as COMING SOON and cannot be bought.
    is_available: Mapped[bool] = mapped_column(checked_bool("is_available"), server_default=sa.true())
    position: Mapped[int]

    __table_args__ = (
        sa.UniqueConstraint("code"),
        sa.UniqueConstraint("position"),
        sa.CheckConstraint("price_gems >= 0", name="price_non_negative"),
        sa.CheckConstraint("(kind = 'xp_boost') = (duration_minutes IS NOT NULL)", name="duration_iff_boost"),
        sa.CheckConstraint("duration_minutes IS NULL OR duration_minutes > 0", name="duration_positive"),
    )


class Quest(Base):
    """A daily quest in the catalogue. Slot 1 is always the daily-goal quest, whose target is the
    learner's own goal; the other slots draw one quest each per learner and day."""

    __tablename__ = "quests"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(sa.String(24))
    slot: Mapped[int]  # 1 daily goal, 2 core, 3 hard
    title_template: Mapped[str] = mapped_column(sa.String(80))  # 'Earn {n} XP'
    metric: Mapped[QuestMetric] = mapped_column(str_enum(QuestMetric, "metric", 20))
    target: Mapped[int | None]  # NULL only for the daily-goal quest
    reward_gems: Mapped[int]
    icon: Mapped[str] = mapped_column(sa.String(16))  # bolt | target | flame | book
    position: Mapped[int]

    __table_args__ = (
        sa.UniqueConstraint("code"),
        sa.UniqueConstraint("position"),
        sa.CheckConstraint("slot IN (1, 2, 3)", name="slot"),
        sa.CheckConstraint("(metric = 'daily_goal_xp') = (target IS NULL)", name="target_iff_not_goal"),
        sa.CheckConstraint("(metric = 'daily_goal_xp') = (slot = 1)", name="goal_in_slot_1"),
        sa.CheckConstraint("target IS NULL OR target > 0", name="target_positive"),
        sa.CheckConstraint("reward_gems > 0", name="reward_positive"),
    )


class QuestClaim(Base):
    """A quest completed, and rewarded automatically, on one local day: one reward per quest per day."""

    __tablename__ = "quest_claims"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(sa.ForeignKey("users.id", ondelete="CASCADE"))
    quest_id: Mapped[int] = mapped_column(sa.ForeignKey("quests.id", ondelete="RESTRICT"), index=True)
    local_date: Mapped[date]
    claimed_at: Mapped[datetime]

    __table_args__ = (sa.UniqueConstraint("user_id", "quest_id", "local_date"),)
