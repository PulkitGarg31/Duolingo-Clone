"""Sessions and their item queues, and the progress facts derived from completed sessions."""

from collections.abc import Sequence
from datetime import datetime

from sqlalchemy import ColumnElement, distinct, func, insert, select, update
from sqlalchemy.orm import Session, selectinload

from app.domain.enums import EndReason, ItemOrigin, ItemResult, SessionKind, SessionStatus
from app.models import LessonSession, SessionItem

# A session is read with its queue. The exercises themselves come from the course content, which is
# read once per database (services/reference.py), so they are not loaded with every session.
_WITH_QUEUE = selectinload(LessonSession.items)
_MISTAKES = (ItemResult.INCORRECT, ItemResult.SKIPPED)


def _completed(user_id: int, kind: SessionKind) -> tuple[ColumnElement[bool], ...]:
    """WHERE terms selecting the learner's completed sessions of one kind."""
    return (
        LessonSession.user_id == user_id,
        LessonSession.kind == kind,
        LessonSession.status == SessionStatus.COMPLETED,
    )


def active_session(db: Session, user_id: int) -> LessonSession | None:
    """The learner's active session, if any; a partial unique index allows at most one."""
    return db.scalar(
        select(LessonSession).where(
            LessonSession.user_id == user_id, LessonSession.status == SessionStatus.ACTIVE
        )
    )


def get_owned_session(db: Session, user_id: int, session_id: int) -> LessonSession | None:
    """One of the learner's sessions with its full queue. Another learner's session counts as missing."""
    return db.scalar(
        select(LessonSession)
        .where(LessonSession.id == session_id, LessonSession.user_id == user_id)
        .options(_WITH_QUEUE)
    )


def add_initial_items(db: Session, session_id: int, planned: Sequence[tuple[int, bool]]) -> None:
    """Insert a new session's planned items, numbered from 1 in play order, in one statement.

    Each planned item is (exercise id, whether practice picked it from the learner's mistakes).
    """
    db.execute(
        insert(SessionItem),
        [
            {
                "session_id": session_id,
                "seq": seq,
                "exercise_id": exercise_id,
                "origin": ItemOrigin.INITIAL,
                "from_mistakes": from_mistakes,
            }
            for seq, (exercise_id, from_mistakes) in enumerate(planned, start=1)
        ],
    )


def reload_session(db: Session, session_id: int) -> LessonSession:
    """Read a session again, overwriting whatever this unit of work holds in memory for it."""
    return db.scalars(
        select(LessonSession)
        .where(LessonSession.id == session_id)
        .options(_WITH_QUEUE)
        .execution_options(populate_existing=True)
    ).one()


def mark_completed(db: Session, session_id: int, now: datetime, *, mistakes: int, best_combo: int) -> bool:
    """Complete an active session in one compare-and-set statement; False if it was no longer active.

    Status, end reason and end time must change in the same statement, because SQLite checks the
    constraints that tie them together after every statement. The WHERE clause makes a second
    completion change nothing, so rewards can never be paid twice.
    """
    result = db.execute(
        update(LessonSession)
        .where(LessonSession.id == session_id, LessonSession.status == SessionStatus.ACTIVE)
        .values(
            status=SessionStatus.COMPLETED,
            end_reason=EndReason.PASSED,
            ended_at=now,
            mistakes=mistakes,
            best_combo=best_combo,
        ),
        # Update the in-memory session only if the row in the database really changed.
        execution_options={"synchronize_session": "fetch"},
    )
    return result.rowcount == 1


def store_receipt(db: Session, session_id: int, receipt_json: str) -> None:
    """Cache a completion receipt, so that completing again replays it instead of rewarding again."""
    db.execute(update(LessonSession).where(LessonSession.id == session_id).values(result_json=receipt_json))


def lessons_completed_by_node(db: Session, user_id: int) -> dict[int, int]:
    """Completed distinct lessons per node. Lessons are played in order, so the count is the cursor."""
    rows = db.execute(
        select(LessonSession.node_id, func.count(distinct(LessonSession.lesson_id)))
        .where(*_completed(user_id, SessionKind.LESSON))
        .group_by(LessonSession.node_id)
    )
    return {node_id: count for node_id, count in rows if node_id is not None}


def legendary_node_ids(db: Session, user_id: int) -> set[int]:
    """Nodes with a passed legendary run."""
    query = select(LessonSession.node_id).where(*_completed(user_id, SessionKind.LEGENDARY))
    return {node_id for node_id in db.scalars(query) if node_id is not None}


def completed_lesson_ids(db: Session, user_id: int) -> set[int]:
    """Lessons the learner has completed: what practice and timed practice draw from."""
    query = select(LessonSession.lesson_id).where(*_completed(user_id, SessionKind.LESSON))
    return {lesson_id for lesson_id in db.scalars(query) if lesson_id is not None}


def count_completed_sessions(db: Session, user_id: int, *, ended_since: datetime | None = None) -> int:
    """Completed sessions of any kind, optionally only those that ended at or after `ended_since`."""
    query = (
        select(func.count())
        .select_from(LessonSession)
        .where(LessonSession.user_id == user_id, LessonSession.status == SessionStatus.COMPLETED)
    )
    if ended_since is not None:
        query = query.where(LessonSession.ended_at >= ended_since)
    return db.scalar(query) or 0


def count_completed_lessons(db: Session, user_id: int) -> int:
    """Completed lesson sessions, unit reviews included (not practice or challenges)."""
    query = select(func.count()).select_from(LessonSession).where(*_completed(user_id, SessionKind.LESSON))
    return db.scalar(query) or 0


def count_perfect_lessons(db: Session, user_id: int) -> int:
    """Completed lesson sessions without a single mistake."""
    query = (
        select(func.count())
        .select_from(LessonSession)
        .where(*_completed(user_id, SessionKind.LESSON), LessonSession.mistakes == 0)
    )
    return db.scalar(query) or 0


def recent_mistake_exercise_ids(db: Session, user_id: int, *, since: datetime) -> list[int]:
    """Exercises the learner got wrong or skipped since `since`, most recent mistake first, each once."""
    last_mistake = func.max(SessionItem.answered_at)
    return list(
        db.scalars(
            select(SessionItem.exercise_id)
            .join(LessonSession, SessionItem.session_id == LessonSession.id)
            .where(
                LessonSession.user_id == user_id,
                SessionItem.result.in_(_MISTAKES),
                SessionItem.answered_at >= since,
            )
            .group_by(SessionItem.exercise_id)
            .order_by(last_mistake.desc(), SessionItem.exercise_id)
        )
    )
