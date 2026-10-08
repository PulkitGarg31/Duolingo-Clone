"""Learners and bots: users plus their 1:1 extension tables.

A bot is simply a user with a `bot_profiles` row; there is no is_bot flag to keep in sync. Only
humans have `user_settings` and `user_stats`, and only humans write ledger rows.
"""

from __future__ import annotations

from datetime import date, datetime

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.types import checked_bool, str_enum
from app.domain.enums import Theme
from app.domain.rules import DAILY_GOAL_OPTIONS, DEFAULT_DAILY_GOAL_XP, MAX_HEARTS, MAX_STREAK_FREEZES
from app.models.base import Base

_DAILY_GOAL_LIST = ", ".join(str(goal) for goal in DAILY_GOAL_OPTIONS)


class User(Base):
    """An account that appears on the leaderboard: the human learner or a seeded league bot."""

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(sa.String(32))  # 'alex'
    display_name: Mapped[str] = mapped_column(sa.String(40))
    avatar_color: Mapped[str] = mapped_column(sa.CHAR(7))  # '#1CB0F6'
    timezone: Mapped[str] = mapped_column(sa.String(64))  # IANA name, validated before it is stored
    # Set once the browser's time zone has been adopted.
    timezone_confirmed: Mapped[bool] = mapped_column(
        checked_bool("timezone_confirmed"), server_default=sa.false()
    )
    current_course_id: Mapped[int] = mapped_column(
        sa.ForeignKey("courses.id", ondelete="RESTRICT"), index=True
    )
    joined_at: Mapped[datetime]

    settings: Mapped[UserSettings | None] = relationship(
        back_populates="user", cascade="all, delete-orphan", passive_deletes=True
    )
    stats: Mapped[UserStats | None] = relationship(
        back_populates="user", cascade="all, delete-orphan", passive_deletes=True
    )
    bot_profile: Mapped[BotProfile | None] = relationship(
        back_populates="user", cascade="all, delete-orphan", passive_deletes=True
    )

    __table_args__ = (
        sa.UniqueConstraint("username"),
        sa.CheckConstraint("username = lower(username)", name="username_lower"),
        sa.CheckConstraint(
            "length(avatar_color) = 7 AND substr(avatar_color, 1, 1) = '#'", name="avatar_color_hex"
        ),
    )


class UserSettings(Base):
    """A human learner's preferences."""

    __tablename__ = "user_settings"

    user_id: Mapped[int] = mapped_column(sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    daily_goal_xp: Mapped[int] = mapped_column(server_default=sa.text(str(DEFAULT_DAILY_GOAL_XP)))
    theme: Mapped[Theme] = mapped_column(str_enum(Theme, "theme", 8), server_default=Theme.SYSTEM.value)
    sound_effects: Mapped[bool] = mapped_column(checked_bool("sound_effects"), server_default=sa.true())
    animations: Mapped[bool] = mapped_column(checked_bool("animations"), server_default=sa.true())
    motivational_messages: Mapped[bool] = mapped_column(
        checked_bool("motivational_messages"), server_default=sa.true()
    )
    listening_exercises: Mapped[bool] = mapped_column(
        checked_bool("listening_exercises"), server_default=sa.true()
    )
    updated_at: Mapped[datetime]

    user: Mapped[User] = relationship(back_populates="settings")

    __table_args__ = (sa.CheckConstraint(f"daily_goal_xp IN ({_DAILY_GOAL_LIST})", name="daily_goal_xp"),)


class UserStats(Base):
    """A human learner's mutable game state: the only counters that are stored rather than derived.

    Hearts are a token bucket (a count plus the start of the running regeneration interval), the
    streak is a state machine, gems cache the gem ledger's balance, and the league tier records the
    last weekly decision. XP totals and progress are always computed from the ledgers instead.
    """

    __tablename__ = "user_stats"

    user_id: Mapped[int] = mapped_column(sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    gems: Mapped[int] = mapped_column(server_default=sa.text("0"))
    hearts: Mapped[int] = mapped_column(server_default=sa.text(str(MAX_HEARTS)))
    hearts_regen_anchor_at: Mapped[datetime | None]  # start of the running regeneration interval
    streak_current: Mapped[int] = mapped_column(server_default=sa.text("0"))
    streak_longest: Mapped[int] = mapped_column(server_default=sa.text("0"))
    streak_last_date: Mapped[date | None]  # last local date covered, by activity or by a freeze
    streak_freezes: Mapped[int] = mapped_column(server_default=sa.text("0"))  # equipped freezes
    league_tier: Mapped[int] = mapped_column(
        sa.ForeignKey("leagues.tier", ondelete="RESTRICT"), index=True, server_default=sa.text("1")
    )
    xp_boost_until: Mapped[datetime | None]  # end of the double-XP window
    updated_at: Mapped[datetime]

    user: Mapped[User] = relationship(back_populates="stats")

    __table_args__ = (
        sa.CheckConstraint("gems >= 0", name="gems_non_negative"),
        sa.CheckConstraint(f"hearts BETWEEN 0 AND {MAX_HEARTS}", name="hearts_range"),
        # Hearts and their anchor are always written in the same flush, so this holds per statement.
        sa.CheckConstraint(
            f"(hearts = {MAX_HEARTS}) = (hearts_regen_anchor_at IS NULL)", name="hearts_anchor"
        ),
        sa.CheckConstraint("streak_current >= 0", name="streak_non_negative"),
        sa.CheckConstraint("streak_longest >= streak_current", name="longest_ge_current"),
        sa.CheckConstraint("(streak_current = 0) = (streak_last_date IS NULL)", name="streak_date_iff_alive"),
        sa.CheckConstraint(f"streak_freezes BETWEEN 0 AND {MAX_STREAK_FREEZES}", name="freezes_range"),
    )


class BotProfile(Base):
    """Marks a user as a seeded league bot and holds its pace and lifetime baseline.

    Bots write no ledger rows: their weekly XP is a pure function of this profile and the week.
    """

    __tablename__ = "bot_profiles"

    user_id: Mapped[int] = mapped_column(sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    daily_xp: Mapped[int]  # expected XP per day before the league tier's pace multiplier
    rng_seed: Mapped[int]  # stable_seed('bot', username)
    baseline_xp: Mapped[int]  # lifetime XP before the demo started
    baseline_streak: Mapped[int]  # the streak shown on the bot's profile and leaderboard row

    user: Mapped[User] = relationship(back_populates="bot_profile")

    __table_args__ = (
        sa.CheckConstraint("daily_xp > 0", name="daily_xp_positive"),
        sa.CheckConstraint("baseline_xp >= 0", name="baseline_xp"),
        sa.CheckConstraint("baseline_streak >= 0", name="baseline_streak"),
    )
