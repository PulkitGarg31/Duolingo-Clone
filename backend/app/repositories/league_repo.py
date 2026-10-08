"""Leagues: tiers, weekly cohorts, memberships and the learners' weekly XP.

Bots write no XP rows; their weekly XP comes from a pure function of their profile, so the
queries here only return their profiles.
"""

from dataclasses import dataclass
from datetime import date, datetime

from sqlalchemy import and_, func, select
from sqlalchemy.orm import Session, contains_eager, joinedload, selectinload

from app.models import BotProfile, League, LeagueCohort, LeagueMembership, User, XpEvent


@dataclass(frozen=True)
class WeeklyXp:
    """A human cohort member's XP in the week window, and when they reached it (None at 0 XP)."""

    user_id: int
    xp: int
    reached_at: datetime | None


# ---- tiers and cohorts ----


def get_league(db: Session, tier: int) -> League | None:
    return db.get(League, tier)


def leagues(db: Session) -> list[League]:
    """The tier ladder, Bronze first."""
    return list(db.scalars(select(League).order_by(League.tier)))


def get_cohort(db: Session, tier: int, week_start: date) -> LeagueCohort | None:
    return db.scalar(
        select(LeagueCohort).where(LeagueCohort.league_tier == tier, LeagueCohort.week_start == week_start)
    )


def open_cohorts_before(db: Session, week_start: date) -> list[LeagueCohort]:
    """Unfinalized cohorts of weeks that started before `week_start`, oldest week first.

    Pass the current week's Monday to get every week that has ended but is not finalized yet.
    """
    return list(
        db.scalars(
            select(LeagueCohort)
            .where(LeagueCohort.finalized_at.is_(None), LeagueCohort.week_start < week_start)
            .order_by(LeagueCohort.week_start, LeagueCohort.league_tier)
        )
    )


# ---- memberships ----


def membership(db: Session, cohort_id: int, user_id: int) -> LeagueMembership | None:
    return db.scalar(
        select(LeagueMembership).where(
            LeagueMembership.cohort_id == cohort_id, LeagueMembership.user_id == user_id
        )
    )


def membership_for_week(db: Session, user_id: int, week_start: date) -> LeagueMembership | None:
    """The learner's membership in the given week, whatever the tier (a learner has at most one)."""
    return db.scalar(
        select(LeagueMembership)
        .join(LeagueMembership.cohort)
        .where(LeagueMembership.user_id == user_id, LeagueCohort.week_start == week_start)
        .options(contains_eager(LeagueMembership.cohort))
    )


def get_membership(db: Session, user_id: int, membership_id: int) -> LeagueMembership | None:
    """One of the learner's memberships with its cohort; another learner's counts as missing."""
    return db.scalar(
        select(LeagueMembership)
        .where(LeagueMembership.id == membership_id, LeagueMembership.user_id == user_id)
        .options(joinedload(LeagueMembership.cohort))
    )


def latest_result(db: Session, user_id: int, *, unseen_only: bool = False) -> LeagueMembership | None:
    """The newest finalized membership with its cohort, optionally among those not yet acknowledged."""
    query = (
        select(LeagueMembership)
        .join(LeagueMembership.cohort)
        .where(LeagueMembership.user_id == user_id, LeagueMembership.outcome.is_not(None))
        .order_by(LeagueCohort.week_start.desc())
        .limit(1)
        .options(contains_eager(LeagueMembership.cohort))
    )
    if unseen_only:
        query = query.where(LeagueMembership.result_seen_at.is_(None))
    return db.scalar(query)


def memberships_with_cohorts(db: Session, user_id: int) -> list[LeagueMembership]:
    """Every membership of a user with its cohort, oldest week first (a bot's career total)."""
    return list(
        db.scalars(
            select(LeagueMembership)
            .join(LeagueMembership.cohort)
            .where(LeagueMembership.user_id == user_id)
            .order_by(LeagueCohort.week_start, LeagueCohort.league_tier)
            .options(contains_eager(LeagueMembership.cohort))
        )
    )


def highest_cohort_tier(db: Session, user_id: int) -> int | None:
    """The highest tier the user has ever competed in, or None before their first cohort."""
    return db.scalar(
        select(func.max(LeagueCohort.league_tier))
        .join(LeagueCohort.memberships)
        .where(LeagueMembership.user_id == user_id)
    )


def latest_cohort_tier(db: Session, user_id: int) -> int | None:
    """The tier of the user's newest cohort (a bot's current league), or None."""
    return db.scalar(
        select(LeagueCohort.league_tier)
        .join(LeagueCohort.memberships)
        .where(LeagueMembership.user_id == user_id)
        .order_by(LeagueCohort.week_start.desc(), LeagueCohort.league_tier.desc())
        .limit(1)
    )


def count_finishes(db: Session, user_id: int, *, best_rank: int, tier: int | None = None) -> int:
    """Finished weeks with a final rank of `best_rank` or better, optionally in one tier only."""
    query = (
        select(func.count())
        .select_from(LeagueMembership)
        .join(LeagueMembership.cohort)
        .where(LeagueMembership.user_id == user_id, LeagueMembership.final_rank <= best_rank)
    )
    if tier is not None:
        query = query.where(LeagueCohort.league_tier == tier)
    return db.scalar(query) or 0


# ---- standings ----


def human_weekly_xp(db: Session, cohort_id: int, start: datetime, end: datetime) -> list[WeeklyXp]:
    """Each human member's XP inside the week window [start, end), summed over the shared ledger."""
    in_week = and_(
        XpEvent.user_id == LeagueMembership.user_id, XpEvent.earned_at >= start, XpEvent.earned_at < end
    )
    rows = db.execute(
        select(
            LeagueMembership.user_id, func.coalesce(func.sum(XpEvent.amount), 0), func.max(XpEvent.earned_at)
        )
        .outerjoin(BotProfile, BotProfile.user_id == LeagueMembership.user_id)
        .outerjoin(XpEvent, in_week)
        .where(LeagueMembership.cohort_id == cohort_id, BotProfile.user_id.is_(None))
        .group_by(LeagueMembership.user_id)
    )
    return [WeeklyXp(user_id, xp, reached_at) for user_id, xp, reached_at in rows]


def bot_members(db: Session, cohort_id: int) -> list[BotProfile]:
    """The bot profiles of a cohort's bot members."""
    return list(
        db.scalars(
            select(BotProfile)
            .join(LeagueMembership, LeagueMembership.user_id == BotProfile.user_id)
            .where(LeagueMembership.cohort_id == cohort_id)
            .order_by(BotProfile.user_id)
        )
    )


def cohort_users(db: Session, cohort_id: int) -> list[User]:
    """Every member of a cohort, with stats (humans) and bot profiles loaded for the leaderboard rows."""
    return list(
        db.scalars(
            select(User)
            .join(LeagueMembership, LeagueMembership.user_id == User.id)
            .where(LeagueMembership.cohort_id == cohort_id)
            .order_by(User.id)
            .options(selectinload(User.stats), selectinload(User.bot_profile))
        )
    )
