"""Session responses: the queue, progress, combo, lives, timer and what the learner may do next.

Nothing here is stored: every number is derived from the session's items, the learner's hearts and
the request's `now`, through the pure session-flow rules.
"""

from dataclasses import dataclass
from datetime import datetime

from app.domain import session_flow
from app.domain.enums import SessionKind, SessionStatus
from app.domain.rng import rng_for
from app.domain.rules import TIMED_BONUS_SECONDS, TIMED_START_SECONDS
from app.domain.session_flow import ItemFacts, SessionFacts
from app.models import LessonSession, PathNode, SessionItem
from app.schemas.common import HeartsOut
from app.schemas.sessions import (
    BlockedReason,
    LivesOut,
    ProgressOut,
    SessionItemOut,
    SessionLessonRef,
    SessionNodeRef,
    SessionOut,
    SessionRules,
    SessionStateOut,
    TimerOut,
)
from app.services.exercises import PromptStyle, payload


@dataclass(frozen=True)
class Scene:
    """What a view of one session needs besides the session itself."""

    node: PathNode | None  # with its unit and lessons loaded; None for global and timed practice
    style: PromptStyle
    hearts: HeartsOut  # the learner's hearts now
    now: datetime


@dataclass(frozen=True)
class Tally:
    """The running numbers of a session's queue."""

    progress: ProgressOut
    mistakes: int
    combo: int
    best_combo: int


def item_facts(session: LessonSession) -> list[ItemFacts]:
    """The session's queue as the session-flow rules see it."""
    return [ItemFacts(item.seq, item.exercise_id, item.origin, item.result) for item in session.items]


def session_facts(session: LessonSession) -> SessionFacts:
    """The parts of the session that decide whether it may complete."""
    return SessionFacts(session.kind, session.status, session.expires_at)


def tally(session: LessonSession) -> Tally:
    """Progress (resolved exercises out of the planned ones), mistakes and combos."""
    items = item_facts(session)
    progress = session_flow.progress(session.kind, items)
    return Tally(
        progress=ProgressOut(completed=progress.completed, total=progress.total),
        mistakes=session_flow.mistakes(items),
        combo=session_flow.combo(items),
        best_combo=session_flow.best_combo(items),
    )


def session_out(session: LessonSession, scene: Scene, *, resumed: bool) -> SessionOut:
    """The whole session: enough to render the lesson player, or to resume it after a refresh."""
    numbers = tally(session)
    lives = session_flow.lives(session.kind, item_facts(session))
    return SessionOut(
        id=session.id,
        kind=session.kind,
        status=session.status,
        end_reason=session.end_reason,
        resumed=resumed,
        node=_node_ref(scene.node),
        lesson=_lesson_ref(session, scene.node),
        rules=SessionRules.model_validate(session_flow.rules_for(session.kind)),
        timer=_timer(session),
        started_at=session.started_at,
        server_now=scene.now,
        hearts=scene.hearts,
        lives=None if lives is None else LivesOut(max=lives.max, left=lives.left),
        progress=numbers.progress,
        mistakes=numbers.mistakes,
        combo=numbers.combo,
        best_combo=numbers.best_combo,
        current_item_id=current_item_id(session),
        blocked_reason=blocked_reason(session, scene.hearts.current),
        can_complete=can_complete(session, scene.hearts.current, scene.now),
        items=[item_out(item, session, scene.style) for item in session.items],
    )


def state_out(session: LessonSession, scene: Scene) -> SessionStateOut:
    """The session after an answer: whether it ended, is blocked or can be completed."""
    lives = session_flow.lives(session.kind, item_facts(session))
    return SessionStateOut(
        status=session.status,
        end_reason=session.end_reason,
        blocked_reason=blocked_reason(session, scene.hearts.current),
        can_complete=can_complete(session, scene.hearts.current, scene.now),
        current_item_id=current_item_id(session),
        lives_left=None if lives is None else lives.left,
        expires_at=session.expires_at,
    )


def item_out(item: SessionItem, session: LessonSession, style: PromptStyle) -> SessionItemOut:
    """One attempt in the queue. Its choices are shuffled by (session seed, seq), so every read of
    the session shows the same order."""
    return SessionItemOut(
        id=item.id,
        seq=item.seq,
        origin=item.origin,
        label=session_flow.item_label(
            session.kind, item.origin, from_mistakes=item.from_mistakes, is_new_word=item.exercise.is_new_word
        ),
        result=item.result,
        note=item.note,
        exercise=payload(item.exercise, style, rng_for(session.rng_seed, item.seq)),
    )


def current_item_id(session: LessonSession) -> int | None:
    """The unanswered item with the lowest seq, or None when nothing is left to answer."""
    current = session_flow.current_item(item_facts(session))
    if current is None:
        return None
    return next(item.id for item in session.items if item.seq == current.seq)


def blocked_reason(session: LessonSession, hearts: int) -> BlockedReason | None:
    """OUT_OF_HEARTS for an active lesson at 0 hearts; it continues after a refill."""
    if session.status != SessionStatus.ACTIVE:
        return None
    reason = session_flow.blocked_reason(session.kind, hearts)
    return None if reason is None else reason.value


def can_complete(session: LessonSession, hearts: int, now: datetime) -> bool:
    """An active, unblocked session completes once nothing is left to answer, or (timed) at time-up."""
    return session_flow.can_complete(session_facts(session), item_facts(session), hearts, now)


def _node_ref(node: PathNode | None) -> SessionNodeRef | None:
    if node is None:
        return None
    return SessionNodeRef(
        id=node.id,
        kind=node.kind,
        title=node.title,
        unit_id=node.unit_id,
        unit_number=node.unit.position,
        unit_color=node.unit.color,
    )


def _lesson_ref(session: LessonSession, node: PathNode | None) -> SessionLessonRef | None:
    """Which lesson of its node a lesson session plays ("Lesson 2 of 3")."""
    if session.lesson_id is None or node is None:
        return None
    lesson = next(lesson for lesson in node.lessons if lesson.id == session.lesson_id)
    return SessionLessonRef(id=lesson.id, number=lesson.position, count=len(node.lessons))


def _timer(session: LessonSession) -> TimerOut | None:
    """Timed practice's clock: the start allowance, the bonus per correct answer and the deadline."""
    if session.kind != SessionKind.TIMED or session.expires_at is None:
        return None
    return TimerOut(
        start_seconds=TIMED_START_SECONDS,
        bonus_seconds=dict(TIMED_BONUS_SECONDS),
        expires_at=session.expires_at,
    )
