"""The ledgers and day facts: XP lines, gem movements, purchases and covered activity days.

Every XP number in the app is a sum over `xp_events`, computed here on demand.
"""

from collections.abc import Collection
from dataclasses import dataclass
from datetime import date, datetime

from sqlalchemy import ColumnElement, and_, case, exists, func, select
from sqlalchemy.orm import Session

from app.domain.enums import ActivityKind, GemReason, XpReason
from app.models import ActivityDay, GemTransaction, LessonSession, Purchase, XpEvent


@dataclass(frozen=True)
class XpLineFact:
    """One XP line earned on some day, with the completion snapshot of the session that earned it."""

    session_id: int
    reason: XpReason
    amount: int
    mistakes: int
    best_combo: int


@dataclass(frozen=True)
class XpTotals:
    """A learner's XP in total, on one local day and in one time window (such as a league week)."""

    total: int
    on_day: int
    in_window: int


# ---- XP ----


def xp_totals(db: Session, user_id: int, day: date, start: datetime, end: datetime) -> XpTotals:
    """Total XP, the XP of local day `day` and the XP earned in [start, end), from one query."""
    in_window = and_(XpEvent.earned_at >= start, XpEvent.earned_at < end)
    total, on_day, in_week = db.execute(
        select(
            func.coalesce(func.sum(XpEvent.amount), 0),
            func.coalesce(func.sum(case((XpEvent.local_date == day, XpEvent.amount), else_=0)), 0),
            func.coalesce(func.sum(case((in_window, XpEvent.amount), else_=0)), 0),
        ).where(XpEvent.user_id == user_id)
    ).one()
    return XpTotals(total, on_day, in_week)


def total_xp(db: Session, user_id: int) -> int:
    return _sum_xp(db, XpEvent.user_id == user_id)


def xp_on(db: Session, user_id: int, day: date) -> int:
    """XP earned on one local day: the daily goal's progress."""
    return _sum_xp(db, XpEvent.user_id == user_id, XpEvent.local_date == day)


def xp_by_day(db: Session, user_id: int, first: date, last: date) -> dict[date, int]:
    """XP per local day from `first` to `last` inclusive; days without XP are absent."""
    rows = db.execute(
        select(XpEvent.local_date, func.sum(XpEvent.amount))
        .where(XpEvent.user_id == user_id, XpEvent.local_date >= first, XpEvent.local_date <= last)
        .group_by(XpEvent.local_date)
    )
    return {day: amount for day, amount in rows}


def xp_lines_on(db: Session, user_id: int, day: date) -> list[XpLineFact]:
    """Every XP line earned on a local day, oldest first: what the daily quests are measured on."""
    rows = db.execute(
        select(
            XpEvent.session_id,
            XpEvent.reason,
            XpEvent.amount,
            LessonSession.mistakes,
            LessonSession.best_combo,
        )
        .join(LessonSession, LessonSession.id == XpEvent.session_id)
        .where(XpEvent.user_id == user_id, XpEvent.local_date == day)
        .order_by(XpEvent.id)
    )
    # Only completed sessions earn XP, and the completion statement writes both snapshots.
    return [XpLineFact(*row) for row in rows]


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


def gems_moved_since(db: Session, user_id: int, since: datetime) -> bool:
    """Whether the learner's gem ledger has a row created at or after `since`."""
    moved = exists().where(GemTransaction.user_id == user_id, GemTransaction.created_at >= since)
    return bool(db.scalar(select(moved)))


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
