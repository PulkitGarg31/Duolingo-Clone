"""The lesson loop: start or resume a session, read it, grade answers, complete it, quit it.

The server owns the queue and every rule. Starting is idempotent (the same kind and node resumes
the active session), answering is an idempotent slot (the same payload replays, a different one is
refused), and completion pays its rewards exactly once behind a compare-and-set. Like every
service, these functions never commit: the router does, once the use case has returned.
"""

from collections.abc import Collection
from dataclasses import dataclass
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app.core import errors
from app.domain import grading, session_flow
from app.domain.content import CourseContent, ExerciseRow, NodeRow
from app.domain.enums import (
    EndReason,
    GemReason,
    GradeNote,
    ItemOrigin,
    ItemResult,
    SessionKind,
    SessionStatus,
    TextLang,
)
from app.domain.planner import (
    ExerciseFacts,
    PlannedItem,
    StartRefusal,
    plan_legendary,
    plan_lesson,
    plan_practice,
    plan_timed,
    start_refusal,
)
from app.domain.rng import rng_for, stable_seed
from app.domain.rules import (
    DEADLINE_GRACE,
    LEGENDARY_PRICE_GEMS,
    MISTAKE_LOOKBACK,
    SESSION_IDLE_TTL,
    TIMED_BONUS_SECONDS,
    TIMED_START_SECONDS,
)
from app.models import LessonSession, SessionItem
from app.repositories import play_repo
from app.schemas.completion import CompletionReceipt
from app.schemas.sessions import AnswerIn, AnswerResultOut, QuitOut, SessionOut, StartSessionIn
from app.services import (
    exercises,
    gems_service,
    hearts_service,
    path_service,
    receipts,
    reference,
    rewards,
    session_views,
)
from app.services.context import RequestContext
from app.services.exercises import PromptStyle
from app.services.league_service import LeagueWeek
from app.services.path_service import PathSnapshot
from app.services.session_views import Scene

# Refusals that carry no extension members, by the planner's reason.
_PLAIN_REFUSALS: dict[StartRefusal, type[errors.AppError]] = {
    StartRefusal.NODE_NOT_PLAYABLE: errors.NodeNotPlayable,
    StartRefusal.NODE_LOCKED: errors.NodeLocked,
    StartRefusal.NODE_ALREADY_COMPLETED: errors.NodeAlreadyCompleted,
    StartRefusal.ALREADY_LEGENDARY: errors.AlreadyLegendary,
    StartRefusal.NOTHING_TO_PRACTICE: errors.NothingToPractice,
}


@dataclass(frozen=True)
class _Plan:
    """A new session's queue, decided before anything is written."""

    rng_seed: int
    items: list[PlannedItem]
    lesson_id: int | None = None  # lesson sessions only


@dataclass(frozen=True)
class Completion:
    """A completed session's receipt, and the learner's league week right after its rewards.

    The router hands the week to `me`, which then has no cohort to rank again. A replayed receipt
    comes without one.
    """

    receipt: CompletionReceipt
    league_week: LeagueWeek | None = None


# ---- start and read ----


def start(db: Session, ctx: RequestContext, request: StartSessionIn) -> tuple[SessionOut, bool]:
    """Start a session, or resume the active one of the same kind and node; True when one was created.

    The preconditions are checked before anything changes, so a refused start leaves an active
    session untouched. Any other active session then ends as superseded. A legendary run pays its
    entry fee here, once: resuming it is free. Resuming counts as activity, so the idle timeout
    starts over.
    """
    active = play_repo.active_session(db, ctx.user.id)
    if active is not None and (active.kind, active.node_id) == (request.kind, request.node_id):
        active.last_activity_at = ctx.now
        return view(db, ctx, _owned(db, ctx, active.id), resumed=True), False
    plan = _plan(db, ctx, request)
    if active is not None:
        _end(active, SessionStatus.ABANDONED, EndReason.SUPERSEDED, ctx.now)
        db.flush()  # frees the one-active-session slot for the new session
    session = _create(db, ctx, request, plan)
    if session.kind == SessionKind.LEGENDARY:
        gems_service.debit(
            db, ctx.user.id, LEGENDARY_PRICE_GEMS, GemReason.LEGENDARY_FEE, now=ctx.now, session_id=session.id
        )
    return view(db, ctx, session, resumed=False), True


def get(db: Session, ctx: RequestContext, session_id: int) -> SessionOut:
    """One of the learner's sessions, active or ended (a refresh resumes at its current item)."""
    return view(db, ctx, _owned(db, ctx, session_id))


def view(db: Session, ctx: RequestContext, session: LessonSession, *, resumed: bool = False) -> SessionOut:
    """The session as the lesson player renders it."""
    return session_views.session_out(session, _scene(db, ctx, _content(db, ctx), session), resumed=resumed)


# ---- answering ----


def answer(
    db: Session, ctx: RequestContext, session_id: int, item_id: int, body: AnswerIn
) -> AnswerResultOut:
    """Grade the answer to one item and apply what it costs, checking in this order:

    1. the session and the item belong to the learner (404);
    2. an item already answered replays the same payload with no side effects, and refuses another;
    3. the session is still active, and a timed one is within its deadline plus a network grace;
    4. the item is the current one, and a lesson is not blocked at 0 hearts;
    5. the answer fits the exercise (422).
    Then the grade is recorded and the session's rules apply: a lesson spends a heart and re-queues
    the exercise, practice re-queues it once, a legendary run fails on its third mistake, and a
    right answer in timed practice adds time to a clock that is still running.
    """
    session = _owned(db, ctx, session_id)
    item = next((queued for queued in session.items if queued.id == item_id), None)
    if item is None:
        raise errors.NotFound("There is no item with that id in this session.")
    content = _content(db, ctx)
    exercise = content.exercise(item.exercise_id)
    submitted = exercises.canonical_json(body)
    if item.result is not None:
        if item.submitted_json != submitted:
            raise errors.ItemAlreadyAnswered()
        return _replay(db, ctx, content, session, item, body)
    _check_answerable(ctx, session, item)
    grade = _grade(content, exercise, body)
    queue_before = session_views.item_facts(session)
    _record(item, grade.result, grade.note, submitted, ctx.now)
    if grade.result == ItemResult.CANT_LISTEN:
        _excuse_listening(session, content, submitted, ctx.now)
    answered = session_flow.ItemFacts(item.seq, item.exercise_id, item.origin)
    outcome = session_flow.decide(session.kind, answered, grade.result, queue_before)
    if outcome.lose_heart:
        hearts_service.lose_one(ctx)
    retry = _queue_retry(session, item) if outcome.append_retry else None
    if outcome.fail:
        _end(session, SessionStatus.FAILED, EndReason.TOO_MANY_MISTAKES, ctx.now)
    # Only timed practice has a deadline. Every right answer moves it later by the exercise's bonus,
    # including one that arrives within the network grace period just after the clock reached zero.
    if session.expires_at is not None and grade.result == ItemResult.CORRECT:
        session.expires_at += timedelta(seconds=TIMED_BONUS_SECONDS.get(exercise.type, 0))
    session.last_activity_at = ctx.now
    db.flush()  # gives a queued retry its id
    return _answer_out(
        _scene(db, ctx, content, session),
        session,
        item,
        grade,
        heart_lost=outcome.lose_heart,
        retry=retry,
        replayed=False,
    )


# ---- ending ----


def complete(db: Session, ctx: RequestContext, session_id: int) -> Completion:
    """Complete a session and pay its rewards, exactly once.

    One compare-and-set statement marks the session completed (status, reason, end time and the
    mistake and combo snapshots together); only the request that wins it pays the rewards and caches
    the receipt. Completing a completed session replays that receipt and writes nothing.

    The learner's path is read once, right after the session counts as completed: the rewards change
    no node's state, so the achievements and the receipt share that one snapshot.
    """
    session = _owned(db, ctx, session_id)
    if session.status == SessionStatus.COMPLETED:
        return Completion(_cached_receipt(session))
    if session.status != SessionStatus.ACTIVE:
        raise errors.SessionNotActive(session.status, session.end_reason)
    if session_views.blocked_reason(session, ctx.stats.hearts) is not None:
        raise hearts_service.out_of_hearts(ctx.stats, ctx.settings)
    if not session_views.can_complete(session, ctx.stats.hearts, ctx.now):
        raise errors.SessionIncomplete()
    before = receipts.capture_before(db, ctx, session)
    queue = session_views.item_facts(session)
    mistakes, best_combo = session_flow.mistakes(queue), session_flow.best_combo(queue)
    if not play_repo.mark_completed(db, session.id, ctx.now, mistakes=mistakes, best_combo=best_combo):
        return Completion(_lost_race(db, session.id))
    path_after = path_service.snapshot(db, ctx.user)
    effects = rewards.apply_completion_rewards(db, ctx, session, path_after)
    after = receipts.capture_after(db, ctx, path_after)
    receipt = receipts.build(
        session, before, after, effects, goal_xp=ctx.preferences.daily_goal_xp, now=ctx.now
    )
    play_repo.store_receipt(db, session.id, receipt.model_dump_json())
    return Completion(receipt, after.league)


def quit_session(db: Session, ctx: RequestContext, session_id: int) -> QuitOut:
    """End a session early, with no XP. The outcome is decided here, never by the client.

    A lesson blocked at 0 hearts fails as out of hearts; anything else is abandoned as quit. Hearts
    already lost and a legendary fee stay spent. Quitting an ended session replays its state.
    """
    session = _owned(db, ctx, session_id)
    replayed = session.status != SessionStatus.ACTIVE
    if not replayed:
        if session_views.blocked_reason(session, ctx.stats.hearts) is not None:
            _end(session, SessionStatus.FAILED, EndReason.OUT_OF_HEARTS, ctx.now)
        else:
            _end(session, SessionStatus.ABANDONED, EndReason.QUIT, ctx.now)
    if session.end_reason is None:  # an ended session always has a reason (a CHECK)
        raise RuntimeError(f"session {session.id} ended without a reason")
    return QuitOut(
        session_id=session.id,
        status=session.status,
        end_reason=session.end_reason,
        replayed=replayed,
        hearts=hearts_service.hearts_out(db, ctx.stats, ctx.settings),
    )


def expire_stale(db: Session, user_id: int, now: datetime) -> int:
    """End the learner's active session once it has been idle for two hours (the sync's last step).

    It ends as abandoned, with no XP. Returns how many sessions ended: 0 or 1. A timed session past
    its deadline is otherwise left for the client to complete.
    """
    session = play_repo.active_session(db, user_id)
    if session is None or now - session.last_activity_at <= SESSION_IDLE_TTL:
        return 0
    _end(session, SessionStatus.ABANDONED, EndReason.IDLE_TIMEOUT, now)
    return 1


# ---- planning a new session ----


def _plan(db: Session, ctx: RequestContext, request: StartSessionIn) -> _Plan:
    """Check the start rules on the learner's path, then plan the queue with the kind's planner.

    The session's seed is derived from who starts what and when, so its plan (and every shuffle of
    its items) is the same on every machine.
    """
    path_now = path_service.snapshot(db, ctx.user)
    node = _requested_node(path_now, request.node_id)
    completed = play_repo.completed_lesson_ids(db, ctx.user.id)
    refusal = start_refusal(
        request.kind,
        None if node is None else (node.kind, path_now.states[node.id]),
        hearts=ctx.stats.hearts,
        gems=ctx.stats.gems,
        lessons_completed=len(completed),
    )
    if refusal is not None:
        raise _refusal_error(refusal, ctx)
    seed = stable_seed(ctx.user.id, request.kind, request.node_id, ctx.now.isoformat())
    listening = ctx.preferences.listening_exercises
    content = path_now.content
    match request.kind:
        case SessionKind.LESSON:
            return _lesson_plan(path_now, _required(node), seed, listening)
        case SessionKind.PRACTICE:
            return _practice_plan(db, ctx, content, node, completed, seed, listening)
        case SessionKind.LEGENDARY:
            pool = content.node_exercises(_required(node))
            return _Plan(seed, plan_legendary(_facts(pool), rng_for(seed), listening_enabled=listening))
        case SessionKind.TIMED:
            pool = content.exercises_in_lessons(completed)
            return _Plan(seed, plan_timed(_facts(pool), rng_for(seed)))


def _lesson_plan(path_now: PathSnapshot, node: NodeRow, seed: int, listening: bool) -> _Plan:
    """The node's next lesson, every exercise in authored order."""
    position = path_now.facts[node.id].lessons_completed + 1
    lesson = next((lesson for lesson in node.lessons if lesson.position == position), None)
    if lesson is None:  # an active node always has a next lesson
        raise RuntimeError(f"node {node.id} has no next lesson")
    items = plan_lesson(_facts(path_now.content.lesson_exercises(lesson)), listening_enabled=listening)
    return _Plan(seed, items, lesson_id=lesson.id)


def _practice_plan(
    db: Session,
    ctx: RequestContext,
    content: CourseContent,
    node: NodeRow | None,
    completed: Collection[int],
    seed: int,
    listening: bool,
) -> _Plan:
    """Exercises of completed lessons (the node's, or all of them), recent mistakes first."""
    lesson_ids = (
        set(completed) if node is None else {lesson.id for lesson in node.lessons}.intersection(completed)
    )
    pool = content.exercises_in_lessons(lesson_ids)
    mistakes = play_repo.recent_mistake_exercise_ids(db, ctx.user.id, since=ctx.now - MISTAKE_LOOKBACK)
    return _Plan(seed, plan_practice(_facts(pool), mistakes, rng_for(seed), listening_enabled=listening))


def _requested_node(path_now: PathSnapshot, node_id: int | None) -> NodeRow | None:
    """The requested node of the learner's course; an unknown id is 404."""
    if node_id is None:
        return None
    node = path_now.node(node_id)
    if node is None:
        raise errors.NotFound("There is no path node with that id.")
    return node


def _required(node: NodeRow | None) -> NodeRow:
    if node is None:  # the request schema requires a node for lessons and legendary runs
        raise ValueError("this kind of session needs a node")
    return node


def _refusal_error(refusal: StartRefusal, ctx: RequestContext) -> errors.AppError:
    """The API error for a refused start, with the extension members its code defines."""
    match refusal:
        case StartRefusal.OUT_OF_HEARTS:
            return hearts_service.out_of_hearts(ctx.stats, ctx.settings)
        case StartRefusal.INSUFFICIENT_GEMS:
            return errors.InsufficientGems(required_gems=LEGENDARY_PRICE_GEMS, balance=ctx.stats.gems)
        case _:
            return _PLAIN_REFUSALS[refusal]()


def _facts(pool: list[ExerciseRow]) -> list[ExerciseFacts]:
    return [ExerciseFacts(exercise.id, exercise.type, exercise.audio_only) for exercise in pool]


def _create(db: Session, ctx: RequestContext, request: StartSessionIn, plan: _Plan) -> LessonSession:
    """Insert the session, then its initial items, numbered from 1 in play order, in one statement."""
    timed = request.kind == SessionKind.TIMED
    session = LessonSession(
        user_id=ctx.user.id,
        kind=request.kind,
        node_id=request.node_id,
        lesson_id=plan.lesson_id,
        status=SessionStatus.ACTIVE,
        rng_seed=plan.rng_seed,
        started_at=ctx.now,
        last_activity_at=ctx.now,
        expires_at=ctx.now + timedelta(seconds=TIMED_START_SECONDS) if timed else None,
    )
    db.add(session)
    db.flush()  # gives the session its id, which its items, the legendary fee and the response need
    play_repo.add_initial_items(
        db, session.id, [(item.exercise_id, item.from_mistakes) for item in plan.items]
    )
    db.refresh(session, ["items"])
    return session


# ---- answering, step by step ----


def _check_answerable(ctx: RequestContext, session: LessonSession, item: SessionItem) -> None:
    """Refuse an answer the session can't take now (checks 3 and 4 of `answer`)."""
    if session.status != SessionStatus.ACTIVE:
        raise errors.SessionNotActive(session.status, session.end_reason)
    if session.expires_at is not None and ctx.now > session.expires_at + DEADLINE_GRACE:
        raise errors.SessionExpired(session.expires_at)
    current = session_views.current_item_id(session)
    if item.id != current:
        raise errors.ItemOutOfOrder(current)
    if session_views.blocked_reason(session, ctx.stats.hearts) is not None:
        raise hearts_service.out_of_hearts(ctx.stats, ctx.settings)


def _grade(content: CourseContent, exercise: ExerciseRow, body: AnswerIn) -> grading.Grade:
    """Grade the answer, refusing one that does not fit the exercise with INVALID_ANSWER."""
    key, given = exercises.answer_key(exercise), exercises.to_answer(body)
    try:
        return grading.grade(key, given, known_words=_course_words(content, exercise))
    except grading.InvalidAnswer as exc:
        raise errors.InvalidAnswer(f"That answer doesn't fit this exercise: {exc}.") from exc


def _record(
    item: SessionItem, result: ItemResult, note: GradeNote | None, submitted: str, now: datetime
) -> None:
    """Store an item's grade with the payload that earned it (what a repeated request is compared to)."""
    item.result, item.note, item.submitted_json, item.answered_at = result, note, submitted, now


def _excuse_listening(session: LessonSession, content: CourseContent, submitted: str, now: datetime) -> None:
    """CAN'T LISTEN NOW resolves every other unanswered listening item too, with no penalty."""
    for item in session.items:
        if item.result is None and content.exercise(item.exercise_id).audio_only:
            _record(item, ItemResult.CANT_LISTEN, None, submitted, now)


def _queue_retry(session: LessonSession, item: SessionItem) -> SessionItem:
    """Append the missed exercise at the end of the queue, where it shows as a previous mistake."""
    retry = SessionItem(
        seq=max(queued.seq for queued in session.items) + 1,
        exercise_id=item.exercise_id,
        origin=ItemOrigin.RETRY,
        from_mistakes=False,
    )
    session.items.append(retry)
    return retry


def _retry_after(session: LessonSession, item: SessionItem) -> SessionItem | None:
    """The retry a wrong answer to `item` queued: the next retry of the same exercise."""
    return next(
        (
            queued
            for queued in session.items
            if queued.origin == ItemOrigin.RETRY
            and queued.exercise_id == item.exercise_id
            and queued.seq > item.seq
        ),
        None,
    )


def _replay(
    db: Session,
    ctx: RequestContext,
    content: CourseContent,
    session: LessonSession,
    item: SessionItem,
    body: AnswerIn,
) -> AnswerResultOut:
    """Answer a repeated request the way the first one was answered, writing nothing.

    Grading is deterministic, so the same payload gets the same verdict. A wrong first answer cost a
    heart where hearts apply, and queued the retry that follows it, if the session's rules did.
    """
    wrong = item.result in session_flow.WRONG
    return _answer_out(
        _scene(db, ctx, content, session),
        session,
        item,
        _grade(content, content.exercise(item.exercise_id), body),
        heart_lost=wrong and session_flow.rules_for(session.kind).hearts_enabled,
        retry=_retry_after(session, item) if wrong else None,
        replayed=True,
    )


def _answer_out(
    scene: Scene,
    session: LessonSession,
    item: SessionItem,
    grade: grading.Grade,
    *,
    heart_lost: bool,
    retry: SessionItem | None,
    replayed: bool,
) -> AnswerResultOut:
    """The feedback bar's verdict plus the session's state after the answer."""
    exercise = scene.content.exercise(item.exercise_id)
    numbers = session_views.tally(session)
    return AnswerResultOut(
        item_id=item.id,
        replayed=replayed,
        result=grade.result,
        is_correct=grade.result == ItemResult.CORRECT,
        note=grade.note,
        correct_answer=grade.correct_answer,
        meaning=exercise.text_translation if exercise.audio_only else None,
        heart_lost=heart_lost,
        hearts=scene.hearts,
        progress=numbers.progress,
        mistakes=numbers.mistakes,
        combo=numbers.combo,
        best_combo=numbers.best_combo,
        appended_item=None if retry is None else session_views.item_out(retry, session, scene),
        session=session_views.state_out(session, scene),
    )


# ---- shared helpers ----


def _owned(db: Session, ctx: RequestContext, session_id: int) -> LessonSession:
    """One of the learner's sessions with its queue; another learner's session counts as missing."""
    session = play_repo.get_owned_session(db, ctx.user.id, session_id)
    if session is None:
        raise errors.NotFound("There is no session with that id.")
    return session


def _end(session: LessonSession, status: SessionStatus, reason: EndReason, now: datetime) -> None:
    """End an active session. The three columns are flushed in one statement, as their CHECKs need."""
    session.status, session.end_reason, session.ended_at = status, reason, now


def _content(db: Session, ctx: RequestContext) -> CourseContent:
    """The learner's course: every session is played in it."""
    return reference.course_content(db, ctx.user.current_course_id)


def _scene(db: Session, ctx: RequestContext, content: CourseContent, session: LessonSession) -> Scene:
    """What every view of the session needs: its node, the prompt style and the learner's hearts."""
    return Scene(
        content=content,
        node=None if session.node_id is None else content.node(session.node_id),
        style=PromptStyle(
            learning_language=TextLang(content.course.learning_language),
            glossary=content.glossary,
            hints_enabled=session_flow.rules_for(session.kind).hints_enabled,  # none in legendary runs
        ),
        hearts=hearts_service.hearts_out(db, ctx.stats, ctx.settings),
        now=ctx.now,
    )


def _cached_receipt(session: LessonSession) -> CompletionReceipt:
    """The stored receipt of a completed session, marked as a replay.

    Sessions of the seeded demo history were completed without one, so there is nothing to replay:
    they are refused like any other ended session.
    """
    if session.result_json is None:
        raise errors.SessionNotActive(session.status, session.end_reason)
    return CompletionReceipt.model_validate_json(session.result_json).model_copy(update={"replayed": True})


def _lost_race(db: Session, session_id: int) -> CompletionReceipt:
    """Another request ended the session first: undo, read it again, and replay or refuse.

    Requests are serialized by BEGIN IMMEDIATE, so this is a backstop that should never run.
    """
    db.rollback()
    session = play_repo.reload_session(db, session_id)
    if session.status == SessionStatus.COMPLETED:
        return _cached_receipt(session)
    raise errors.SessionNotActive(session.status, session.end_reason)


def _course_words(content: CourseContent, exercise: ExerciseRow) -> frozenset[str]:
    """The course's words in the language a typed answer to `exercise` is written in.

    They keep the typo rule from forgiving a slip that spells another real word. Exercises that are
    not typed need none.
    """
    if exercise.type not in grading.TYPED_TYPES:
        return frozenset()
    return content.vocabulary[exercise.answer_language]
