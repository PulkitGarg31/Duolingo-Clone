"""Learners and bots: users plus their 1:1 extension tables.

A bot is simply a user with a `bot_profiles` row; there is no is_bot flag to keep in sync. Only
humans have `user_settings` and `user_stats`, and only humans write ledger rows. A human with an
email and a password hash is an account that can log in. The seeded demo learner, the guests (each
visitor's private copy of the demo) and the bots have neither.
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
    """Anyone who appears on a leaderboard: a human learner or a seeded league bot.

    Each human runs on a simulated clock of their own: real UTC plus `clock_offset_seconds`. The
    offset only ever grows, so rows written earlier can never end up in the future; resetting the
    learner's progress is the only way back to 0.

    A guest is a visitor's private copy of the demo: the seeded learner's sample history under a user
    of its own, created without credentials and deleted, oldest first, once there are too many.
    """

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
    email: Mapped[str | None] = mapped_column(sa.String(254))  # stored trimmed and lowercased
    password_hash: Mapped[str | None] = mapped_column(sa.String(255))  # 'scrypt$16384$8$1$<salt>$<hash>'
    clock_offset_seconds: Mapped[int] = mapped_column(server_default=sa.text("0"))
    is_guest: Mapped[bool] = mapped_column(checked_bool("is_guest"), server_default=sa.false())
    # Real instant the sample history was last written for this learner: the seeded demo learner and
    # guests have one, accounts and bots never.
    history_seeded_at: Mapped[datetime | None]

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
        # One account per address; the many users without one (NULL) don't collide.
        sa.UniqueConstraint("email"),
        sa.CheckConstraint("username = lower(username)", name="username_lower"),
        sa.CheckConstraint(
            "length(avatar_color) = 7 AND substr(avatar_color, 1, 1) = '#'", name="avatar_color_hex"
        ),
        # Lowercased on the way in, so the unique key is case-insensitive.
        sa.CheckConstraint("email = lower(email)", name="email_lower"),
        # Credentials come as a pair: an account has both, the demo learner, guests and bots neither.
        sa.CheckConstraint("(email IS NULL) = (password_hash IS NULL)", name="credentials_pair"),
        # A guest never has credentials: it can't log in, and signing up creates a separate account.
        sa.CheckConstraint("is_guest = 0 OR email IS NULL", name="guest_without_credentials"),
        sa.CheckConstraint("clock_offset_seconds >= 0", name="offset_forward_only"),
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
