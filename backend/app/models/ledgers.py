"""Append-only ledgers and day facts: XP lines, purchases, gem movements and covered days.

These are facts. Every total in the app (XP today, XP this week, gem balance) is derived from
them, and the unique keys make each reward exactly-once at the database level.
"""

from __future__ import annotations

from datetime import date, datetime

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column

from app.core.types import str_enum
from app.domain.enums import ActivityKind, GemReason, XpReason
from app.domain.rules import DAILY_GOAL_OPTIONS
from app.models.base import Base

_DAILY_GOAL_LIST = ", ".join(str(goal) for goal in DAILY_GOAL_OPTIONS)


class XpEvent(Base):
    """One XP line of a completed session (base, combo or boost). The only source of XP numbers."""

    __tablename__ = "xp_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(sa.ForeignKey("users.id", ondelete="CASCADE"))
    session_id: Mapped[int] = mapped_column(sa.ForeignKey("lesson_sessions.id", ondelete="CASCADE"))
    reason: Mapped[XpReason] = mapped_column(str_enum(XpReason, "reason", 10))
    amount: Mapped[int]
    earned_at: Mapped[datetime]  # UTC instant: places the line in a league week
    local_date: Mapped[date]  # the learner's local day when earned: daily goal and calendar

    __table_args__ = (
        sa.UniqueConstraint("session_id", "reason"),  # exactly-once XP, enforced by the database
        sa.CheckConstraint("amount > 0", name="amount_positive"),
        sa.Index(None, "user_id", "local_date"),  # XP today, the daily goal, the activity calendar
        sa.Index(None, "user_id", "earned_at"),  # weekly league XP, total XP
    )


class Purchase(Base):
    """A shop purchase. The client's Idempotency-Key makes a retried request return the same row."""

    __tablename__ = "purchases"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(sa.ForeignKey("users.id", ondelete="CASCADE"))
    shop_item_id: Mapped[int] = mapped_column(sa.ForeignKey("shop_items.id", ondelete="RESTRICT"), index=True)
    price_gems: Mapped[int]  # the price paid, kept even if the catalogue price changes later
    idempotency_key: Mapped[str] = mapped_column(sa.String(64))
    purchased_at: Mapped[datetime]

    __table_args__ = (
        sa.UniqueConstraint("user_id", "idempotency_key"),
        sa.CheckConstraint("price_gems >= 0", name="price_non_negative"),
    )


class GemTransaction(Base):
    """One gem movement, pointing at its source; `user_stats.gems` caches the running balance.

    Each reason requires the foreign key of its source (a chest node, a quest claim, a purchase or
    a legendary session); the other source columns are simply left NULL. `balance_after` makes
    every row self-checking. The chest row is itself the chest claim: a partial unique index
    allows one per learner and chest.
    """

    __tablename__ = "gem_transactions"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(sa.ForeignKey("users.id", ondelete="CASCADE"))
    delta: Mapped[int]
    balance_after: Mapped[int]
    reason: Mapped[GemReason] = mapped_column(str_enum(GemReason, "reason", 16))
    node_id: Mapped[int | None] = mapped_column(sa.ForeignKey("path_nodes.id", ondelete="RESTRICT"))
    quest_claim_id: Mapped[int | None] = mapped_column(sa.ForeignKey("quest_claims.id", ondelete="CASCADE"))
    purchase_id: Mapped[int | None] = mapped_column(sa.ForeignKey("purchases.id", ondelete="CASCADE"))
    session_id: Mapped[int | None] = mapped_column(sa.ForeignKey("lesson_sessions.id", ondelete="CASCADE"))
    created_at: Mapped[datetime]

    __table_args__ = (
        sa.CheckConstraint("delta <> 0", name="delta_non_zero"),
        sa.CheckConstraint("balance_after >= 0", name="balance_non_negative"),
        sa.CheckConstraint("reason <> 'chest' OR node_id IS NOT NULL", name="chest_source"),
        sa.CheckConstraint("reason <> 'quest' OR quest_claim_id IS NOT NULL", name="quest_source"),
        sa.CheckConstraint("reason <> 'purchase' OR purchase_id IS NOT NULL", name="purchase_source"),
        sa.CheckConstraint("reason <> 'legendary_fee' OR session_id IS NOT NULL", name="fee_source"),
        # Spending is negative and earning positive; only the demo tools may move gems either way.
        sa.CheckConstraint(
            "(reason IN ('purchase', 'legendary_fee') AND delta < 0)"
            " OR (reason IN ('seed', 'chest', 'quest') AND delta > 0)"
            " OR reason = 'dev'",
            name="sign",
        ),
        # Exactly-once rewards and charges: one claim per learner and chest, one row per quest claim,
        # one row per purchase, and one entry fee per legendary session.
        sa.Index(
            "ux_gem_transactions_chest_once",
            "user_id",
            "node_id",
            unique=True,
            sqlite_where=sa.text("reason = 'chest'"),
        ),
        sa.Index(
            "ux_gem_transactions_quest_claim",
            "quest_claim_id",
            unique=True,
            sqlite_where=sa.text("quest_claim_id IS NOT NULL"),
        ),
        sa.Index(
            "ux_gem_transactions_purchase",
            "purchase_id",
            unique=True,
            sqlite_where=sa.text("purchase_id IS NOT NULL"),
        ),
        sa.Index(
            "ux_gem_transactions_fee_once",
            "session_id",
            unique=True,
            sqlite_where=sa.text("reason = 'legendary_fee'"),
        ),
        sa.Index(None, "user_id", "created_at"),  # ledger history and balance checks
        sa.Index(None, "node_id"),
        sa.Index(None, "session_id"),
    )


class ActivityDay(Base):
    """A local day that counts for the streak: active (a session earned XP) or frozen (a Streak
    Freeze covered it). It also keeps the daily goal in force that day, which can't be recomputed
    later; the XP earned that day is still summed from `xp_events`."""

    __tablename__ = "activity_days"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(sa.ForeignKey("users.id", ondelete="CASCADE"))
    local_date: Mapped[date]
    kind: Mapped[ActivityKind] = mapped_column(str_enum(ActivityKind, "kind", 8))
    goal_xp: Mapped[int | None]  # active days only
    created_at: Mapped[datetime]

    __table_args__ = (
        sa.UniqueConstraint("user_id", "local_date"),
        sa.CheckConstraint("(kind = 'active') = (goal_xp IS NOT NULL)", name="goal_iff_active"),
        sa.CheckConstraint(f"goal_xp IS NULL OR goal_xp IN ({_DAILY_GOAL_LIST})", name="goal_value"),
    )
