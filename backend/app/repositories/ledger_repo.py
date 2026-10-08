"""The ledgers and day facts: XP lines, gem movements, purchases and covered activity days.

Every XP number in the app is a sum over `xp_events`, computed here on demand.
"""

from collections.abc import Collection
from dataclasses import dataclass
from datetime import date, datetime

from sqlalchemy import ColumnElement, func, select
from sqlalchemy.orm import Session

from app.domain.enums import ActivityKind, GemReason, XpReason
from app.models import ActivityDay, GemTransaction, LessonSession, Purchase, XpEvent

_LESSON_REASONS = (XpReason.LESSON, XpReason.REVIEW)


@dataclass(frozen=True)
class LessonFact:
    """A completed lesson or unit review that earned XP on some day, with its completion snapshot."""

    session_id: int
    mistakes: int
    best_combo: int


# ---- XP ----


def total_xp(db: Session, user_id: int) -> int:
    return _sum_xp(db, XpEvent.user_id == user_id)


def xp_on(db: Session, user_id: int, day: date, *, reason: XpReason | None = None) -> int:
    """XP earned on one local day, optionally only the lines of one reason (e.g. combo bonuses)."""
    terms: list[ColumnElement[bool]] = [XpEvent.user_id == user_id, XpEvent.local_date == day]
    if reason is not None:
        terms.append(XpEvent.reason == reason)
    return _sum_xp(db, *terms)


def xp_between(db: Session, user_id: int, start: datetime, end: datetime) -> int:
    """XP earned in the half-open window [start, end), such as a league week."""
    return _sum_xp(db, XpEvent.user_id == user_id, XpEvent.earned_at >= start, XpEvent.earned_at < end)


def xp_by_day(db: Session, user_id: int, first: date, last: date) -> dict[date, int]:
    """XP per local day from `first` to `last` inclusive; days without XP are absent."""
    rows = db.execute(
        select(XpEvent.local_date, func.sum(XpEvent.amount))
        .where(XpEvent.user_id == user_id, XpEvent.local_date >= first, XpEvent.local_date <= last)
        .group_by(XpEvent.local_date)
    )
    return {day: amount for day, amount in rows}


def lesson_facts_on(db: Session, user_id: int, day: date) -> list[LessonFact]:
    """The lessons and reviews that earned XP on a local day: what the lesson quests count."""
    earned_lesson_xp = select(XpEvent.session_id).where(
        XpEvent.user_id == user_id, XpEvent.local_date == day, XpEvent.reason.in_(_LESSON_REASONS)
    )
    rows = db.execute(
        select(LessonSession.id, LessonSession.mistakes, LessonSession.best_combo)
        .where(LessonSession.id.in_(earned_lesson_xp))
        .order_by(LessonSession.id)
    )
    # Only completed sessions earn XP, and the completion statement writes both snapshots.
    return [LessonFact(session_id, mistakes, best_combo) for session_id, mistakes, best_combo in rows]


def _sum_xp(db: Session, *terms: ColumnElement[bool]) -> int:
    return db.scalar(select(func.coalesce(func.sum(XpEvent.amount), 0)).where(*terms)) or 0


# ---- activity days (the streak calendar) ----


def activity_day(db: Session, user_id: int, day: date) -> ActivityDay | None:
    return db.scalar(select(ActivityDay).where(ActivityDay.user_id == user_id, ActivityDay.local_date == day))


def activity_days_between(db: Session, user_id: int, first: date, last: date) -> list[ActivityDay]:
    """Covered days from `first` to `last` inclusive, oldest first."""
    return list(
        db.scalars(
            select(ActivityDay)
            .where(
                ActivityDay.user_id == user_id,
                ActivityDay.local_date >= first,
                ActivityDay.local_date <= last,
            )
            .order_by(ActivityDay.local_date)
        )
    )


def mark_active_day(db: Session, user_id: int, day: date, *, goal_xp: int, now: datetime) -> ActivityDay:
    """Record `day` as active with the goal in force (an upsert: a row already there is updated)."""
    row = activity_day(db, user_id, day)
    if row is None:
        row = ActivityDay(
            user_id=user_id, local_date=day, kind=ActivityKind.ACTIVE, goal_xp=goal_xp, created_at=now
        )
        db.add(row)
    else:
        row.kind, row.goal_xp = ActivityKind.ACTIVE, goal_xp
    return row


def mark_frozen_days(db: Session, user_id: int, days: Collection[date], *, now: datetime) -> None:
    """Record days covered by a Streak Freeze. A day that already has a row keeps it (insert-or-ignore)."""
    if not days:
        return
    covered = set(
        db.scalars(
            select(ActivityDay.local_date).where(
                ActivityDay.user_id == user_id, ActivityDay.local_date.in_(days)
            )
        )
    )
    for day in sorted(set(days) - covered):
        db.add(
            ActivityDay(
                user_id=user_id, local_date=day, kind=ActivityKind.FROZEN, goal_xp=None, created_at=now
            )
        )


# ---- gems and purchases ----


def claimed_chest_node_ids(db: Session, user_id: int) -> set[int]:
    """Chests the learner has opened: the chest reward row is the claim itself."""
    query = select(GemTransaction.node_id).where(
        GemTransaction.user_id == user_id, GemTransaction.reason == GemReason.CHEST
    )
    return {node_id for node_id in db.scalars(query) if node_id is not None}


def chest_claim(db: Session, user_id: int, node_id: int) -> GemTransaction | None:
    """The gem row that opened this chest for the learner, if it was opened."""
    return db.scalar(
        select(GemTransaction).where(
            GemTransaction.user_id == user_id,
            GemTransaction.reason == GemReason.CHEST,
            GemTransaction.node_id == node_id,
        )
    )


def purchase_by_key(db: Session, user_id: int, idempotency_key: str) -> Purchase | None:
    """The purchase a learner already made with this Idempotency-Key, if any."""
    return db.scalar(
        select(Purchase).where(Purchase.user_id == user_id, Purchase.idempotency_key == idempotency_key)
    )


def get_purchase(db: Session, user_id: int, purchase_id: int) -> Purchase | None:
    """One of the learner's purchases; another learner's counts as missing."""
    return db.scalar(select(Purchase).where(Purchase.id == purchase_id, Purchase.user_id == user_id))
