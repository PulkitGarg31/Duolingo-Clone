"""Weekly leagues: the tier ladder, one cohort per tier and UTC week, and each member's result."""

from __future__ import annotations

from datetime import date, datetime

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.types import str_enum
from app.domain.enums import LeagueOutcome
from app.models.base import Base


class League(Base):
    """Reference data for one of the ten tiers (Bronze to Diamond) and how many move up or down."""

    __tablename__ = "leagues"

    # The natural key: 1 Bronze ... 10 Diamond.
    tier: Mapped[int] = mapped_column(primary_key=True, autoincrement=False)
    name: Mapped[str] = mapped_column(sa.String(16))
    color: Mapped[str] = mapped_column(sa.CHAR(7))  # badge colour
    promote_count: Mapped[int]
    demote_count: Mapped[int]

    __table_args__ = (
        sa.UniqueConstraint("name"),
        sa.CheckConstraint("tier BETWEEN 1 AND 10", name="tier_range"),
        sa.CheckConstraint("promote_count >= 0 AND demote_count >= 0", name="counts"),
        sa.CheckConstraint("tier < 10 OR promote_count = 0", name="no_promotion_from_top"),
        sa.CheckConstraint("tier > 1 OR demote_count = 0", name="no_demotion_from_bottom"),
    )


class LeagueCohort(Base):
    """The competition group of one tier in one league week (which starts Monday 00:00 UTC).

    Cohorts are finalized lazily, one week at a time, after the week has ended.
    """

    __tablename__ = "league_cohorts"

    id: Mapped[int] = mapped_column(primary_key=True)
    league_tier: Mapped[int] = mapped_column(sa.ForeignKey("leagues.tier", ondelete="RESTRICT"))
    week_start: Mapped[date]
    created_at: Mapped[datetime]
    finalized_at: Mapped[datetime | None]

    memberships: Mapped[list[LeagueMembership]] = relationship(
        back_populates="cohort", cascade="all, delete-orphan", passive_deletes=True
    )

    __table_args__ = (
        sa.UniqueConstraint("league_tier", "week_start"),
        sa.CheckConstraint("strftime('%w', week_start) = '1'", name="week_starts_monday"),  # '1' is Monday
        # Open cohorts only: the lazy weekly rollover looks for unfinalized weeks.
        sa.Index("ix_league_cohorts_open", "week_start", sqlite_where=sa.text("finalized_at IS NULL")),
    )


class LeagueMembership(Base):
    """A user's place in a cohort, humans and bots alike.

    Final XP, rank and outcome are written for every member when the week is finalized.
    """

    __tablename__ = "league_memberships"

    id: Mapped[int] = mapped_column(primary_key=True)
    cohort_id: Mapped[int] = mapped_column(sa.ForeignKey("league_cohorts.id", ondelete="CASCADE"))
    user_id: Mapped[int] = mapped_column(sa.ForeignKey("users.id", ondelete="CASCADE"), index=True)
    joined_at: Mapped[datetime]
    final_xp: Mapped[int | None]
    final_rank: Mapped[int | None]
    outcome: Mapped[LeagueOutcome | None] = mapped_column(str_enum(LeagueOutcome, "outcome", 8))
    result_seen_at: Mapped[datetime | None]  # humans: when the result modal was acknowledged

    cohort: Mapped[LeagueCohort] = relationship(back_populates="memberships")

    __table_args__ = (
        sa.UniqueConstraint("cohort_id", "user_id"),
        sa.UniqueConstraint("cohort_id", "final_rank"),
        sa.CheckConstraint("(final_rank IS NULL) = (outcome IS NULL)", name="final_rank_outcome"),
        sa.CheckConstraint("(final_rank IS NULL) = (final_xp IS NULL)", name="final_rank_xp"),
        sa.CheckConstraint("final_rank IS NULL OR final_rank >= 1", name="rank_positive"),
        sa.CheckConstraint("final_xp IS NULL OR final_xp >= 0", name="xp_non_negative"),
        sa.CheckConstraint("result_seen_at IS NULL OR outcome IS NOT NULL", name="seen_after_final"),
    )
