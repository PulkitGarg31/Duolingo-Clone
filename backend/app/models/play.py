"""Play: sessions and their server-side queue of attempts.

The server owns the queue: a wrong answer appends a retry item, and grading, hearts and XP are
all decided here rather than in the browser.
"""

from __future__ import annotations

from datetime import datetime

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.types import checked_bool, str_enum
from app.domain.enums import EndReason, GradeNote, ItemOrigin, ItemResult, SessionKind, SessionStatus
from app.models.base import Base


class LessonSession(Base):
    """One play-through: a path lesson, practice, a legendary run or timed practice.

    For lesson sessions `node_id` repeats `lessons.node_id`; the composite foreign key
    (lesson_id, node_id) -> lessons(id, node_id) makes that copy safe. When `lesson_id` is NULL
    (practice, legendary, timed) SQL's MATCH SIMPLE rule skips the composite key, and `node_id`
    keeps its own foreign key. The status, its end reason and its end time are only ever written
    together, by one statement, because SQLite checks constraints statement by statement.
    """

    __tablename__ = "lesson_sessions"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(sa.ForeignKey("users.id", ondelete="CASCADE"))
    kind: Mapped[SessionKind] = mapped_column(str_enum(SessionKind, "kind", 10))
    # NULL for global practice and timed practice.
    node_id: Mapped[int | None] = mapped_column(sa.ForeignKey("path_nodes.id", ondelete="RESTRICT"))
    lesson_id: Mapped[int | None]  # lesson sessions only; see the composite foreign key below
    status: Mapped[SessionStatus] = mapped_column(
        str_enum(SessionStatus, "status", 10), server_default=SessionStatus.ACTIVE.value
    )
    end_reason: Mapped[EndReason | None] = mapped_column(str_enum(EndReason, "end_reason", 20))
    rng_seed: Mapped[int]  # stable_seed(user_id, kind, node_id, started_at): the same plan on resume
    started_at: Mapped[datetime]
    last_activity_at: Mapped[datetime]  # for the idle timeout
    expires_at: Mapped[datetime | None]  # timed practice only: the moving deadline
    ended_at: Mapped[datetime | None]
    # Snapshots written by the completion statement, so quests and achievements can filter in SQL.
    mistakes: Mapped[int | None]
    best_combo: Mapped[int | None]
    # The completion receipt, cached for replays. Deliberately unconstrained: it is written after
    # the status changes, and a CHECK tying it to the status would fail that earlier statement.
    result_json: Mapped[str | None] = mapped_column(sa.Text)

    items: Mapped[list[SessionItem]] = relationship(
        back_populates="session",
        order_by="SessionItem.seq",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    __table_args__ = (
        sa.ForeignKeyConstraint(
            ["lesson_id", "node_id"], ["lessons.id", "lessons.node_id"], ondelete="RESTRICT"
        ),
        sa.CheckConstraint("(kind = 'lesson') = (lesson_id IS NOT NULL)", name="lesson_iff_kind"),
        sa.CheckConstraint("kind IN ('practice', 'timed') OR node_id IS NOT NULL", name="node_required"),
        sa.CheckConstraint("kind <> 'timed' OR node_id IS NULL", name="timed_global"),
        sa.CheckConstraint("(kind = 'timed') = (expires_at IS NOT NULL)", name="deadline_iff_timed"),
        sa.CheckConstraint("(status = 'active') = (ended_at IS NULL)", name="active_no_end"),
        sa.CheckConstraint("(status = 'active') = (end_reason IS NULL)", name="active_no_reason"),
        sa.CheckConstraint("status <> 'completed' OR end_reason = 'passed'", name="completed_reason"),
        sa.CheckConstraint(
            "status <> 'failed' OR end_reason IN ('out_of_hearts', 'too_many_mistakes')", name="failed_reason"
        ),
        sa.CheckConstraint(
            "status <> 'abandoned' OR end_reason IN ('quit', 'idle_timeout', 'superseded')",
            name="abandoned_reason",
        ),
        sa.CheckConstraint("ended_at IS NULL OR ended_at >= started_at", name="end_after_start"),
        sa.CheckConstraint("mistakes IS NULL OR mistakes >= 0", name="mistakes"),
        sa.CheckConstraint("best_combo IS NULL OR best_combo >= 0", name="best_combo"),
        # At most one active session per learner: the anchor of resume and supersede.
        sa.Index(
            "ux_lesson_sessions_one_active", "user_id", unique=True, sqlite_where=sa.text("status = 'active'")
        ),
        sa.Index(None, "user_id", "status", "ended_at"),  # completed-session counts, today's sessions
        sa.Index(None, "node_id"),  # per-node progress
        sa.Index(None, "lesson_id", "node_id"),  # backs the composite foreign key
    )


class SessionItem(Base):
    """One attempt in a session's queue. Initial items are numbered 1..n; a retry gets max(seq) + 1."""

    __tablename__ = "session_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    session_id: Mapped[int] = mapped_column(sa.ForeignKey("lesson_sessions.id", ondelete="CASCADE"))
    seq: Mapped[int]
    exercise_id: Mapped[int] = mapped_column(sa.ForeignKey("exercises.id", ondelete="RESTRICT"), index=True)
    origin: Mapped[ItemOrigin] = mapped_column(str_enum(ItemOrigin, "origin", 8))
    # Practice picked it from the learner's recent mistakes (the PREVIOUS MISTAKE label).
    from_mistakes: Mapped[bool] = mapped_column(checked_bool("from_mistakes"), server_default=sa.false())
    result: Mapped[ItemResult | None] = mapped_column(str_enum(ItemResult, "result", 12))
    # Its values are listed by the "note" CHECK below, which also ties each note to a result.
    note: Mapped[GradeNote | None] = mapped_column(str_enum(GradeNote, "note", 16, check=False))
    # The answer payload as canonical JSON: a repeated request is compared against it.
    submitted_json: Mapped[str | None] = mapped_column(sa.Text)
    answered_at: Mapped[datetime | None]

    session: Mapped[LessonSession] = relationship(back_populates="items")

    __table_args__ = (
        sa.UniqueConstraint("session_id", "seq"),
        sa.CheckConstraint("seq >= 1", name="seq_positive"),
        sa.CheckConstraint("(result IS NULL) = (answered_at IS NULL)", name="answered_pair"),
        sa.CheckConstraint("(result IS NULL) = (submitted_json IS NULL)", name="payload_pair"),
        sa.CheckConstraint(
            "note IS NULL"
            " OR (result = 'correct' AND note IN ('alternate', 'accent', 'typo'))"
            " OR (result = 'incorrect' AND note IN ('missing_word', 'wrong_word'))",
            name="note",
        ),
    )
