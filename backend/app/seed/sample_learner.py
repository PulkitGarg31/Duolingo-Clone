"""The sample learner in the database: write the planned history, and rebuild the demo on reset.

`apply_sample_learner_state` reads what the plan needs (`load_world`), plans the history with
`app.seed.history` and writes it with Core statements, then evaluates achievements so the badges can
never disagree with the data. No service is replayed. `reset_demo` wipes every user's learner data
and applies the history again, relative to a new instant.
"""

from collections import defaultdict
from collections.abc import Sequence
from datetime import datetime
from typing import Final

from sqlalchemy import delete, insert, select, update
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.errors import NotFound
from app.domain.enums import EndReason, SessionStatus
from app.models import (
    ActivityDay,
    BotProfile,
    GemTransaction,
    LeagueCohort,
    LeagueMembership,
    LessonSession,
    Purchase,
    QuestClaim,
    SessionItem,
    User,
    UserAchievement,
    UserSettings,
    UserStats,
    XpEvent,
)
from app.repositories import content_repo, gamification_repo, system_repo, user_repo
from app.seed.history import (
    BotInfo,
    ExerciseInfo,
    GemMove,
    LessonInfo,
    NodeInfo,
    PlannedCohort,
    PlannedPurchase,
    PlannedSession,
    SampleRows,
    SampleWorld,
    ShopInfo,
    plan_sample_learner,
)
from app.seed.schema import SampleLearnerFile
from app.seed.validate import DATA_DIR, load_bundle
from app.services import achievement_service, exercises

# Learner-side tables, children before parents. A reset empties them for every user; content,
# catalogues, bot users and bot profiles stay.
LEARNER_TABLES: Final = (
    QuestClaim,
    UserAchievement,
    GemTransaction,
    Purchase,
    XpEvent,
    SessionItem,
    LessonSession,
    ActivityDay,
    LeagueMembership,
    LeagueCohort,
    UserStats,
    UserSettings,
)


# ---- reading what the plan needs ----


def load_world(db: Session, course_id: int) -> SampleWorld:
    """Read the course's content, the shop and the bot pool that the plan works from."""
    by_lesson: defaultdict[int, list[ExerciseInfo]] = defaultdict(list)
    for exercise in sorted(content_repo.course_exercises(db, course_id), key=lambda e: e.position):
        by_lesson[exercise.lesson_id].append(ExerciseInfo(exercise.id, exercises.answer_key(exercise)))
    nodes = tuple(
        NodeInfo(
            node.id,
            node.key,
            node.kind,
            node.chest_gems,
            tuple(LessonInfo(lesson.id, tuple(by_lesson[lesson.id])) for lesson in node.lessons),
        )
        for unit in content_repo.course_path(db, course_id)
        for node in unit.nodes
    )
    shop = {
        item.code: ShopInfo(item.id, item.kind, item.price_gems, item.duration_minutes)
        for item in gamification_repo.shop_items(db)
    }
    profiles = db.scalars(select(BotProfile).order_by(BotProfile.user_id))
    bots = tuple(BotInfo(profile.user_id, profile.rng_seed, profile.daily_xp) for profile in profiles)
    return SampleWorld(nodes, shop, bots)


# ---- writing ----


def apply_sample_learner_state(
    db: Session, learner_id: int, script: SampleLearnerFile, *, now: datetime, tz: str
) -> None:
    """Give the learner the scripted history relative to `now`, in time zone `tz`.

    The learner must exist with fresh settings and stats and no history. Rows are written with
    Core statements in the caller's transaction (never committed here); then achievements are
    evaluated, unlocked at `now`.
    """
    learner = user_repo.get(db, learner_id)
    if learner is None:
        raise NotFound("There is no learner with that id.")
    world = load_world(db, learner.current_course_id)
    rows = plan_sample_learner(script, world, learner_id=learner_id, now=now, tz=tz)
    db.flush()  # anything pending goes first, so a later flush can't overwrite the statements below
    _write_history(db, learner_id, rows)
    _write_learner(db, learner_id, rows, now=now, tz=tz)
    db.expire_all()  # objects loaded earlier must re-read the rows just written
    achievement_service.evaluate(db, learner_id, now)


def _write_history(db: Session, learner_id: int, rows: SampleRows) -> None:
    """Sessions with their items and XP, purchases, the gem ledger, the calendar and the cohorts."""
    session_ids = [_insert_session(db, learner_id, session) for session in rows.sessions]
    db.execute(
        insert(SessionItem),
        [
            {
                "session_id": session_id,
                "seq": answer.seq,
                "exercise_id": answer.exercise_id,
                "origin": answer.origin,
                "from_mistakes": answer.from_mistakes,
                "result": answer.result,
                "note": answer.note,
                "submitted_json": answer.submitted_json,
                "answered_at": answer.answered_at,
            }
            for session, session_id in zip(rows.sessions, session_ids, strict=True)
            for answer in session.answers
        ],
    )
    db.execute(
        insert(XpEvent),
        [
            {
                "user_id": learner_id,
                "session_id": session_id,
                "reason": line.reason,
                "amount": line.amount,
                "earned_at": session.ended_at,
                "local_date": session.local_date,
            }
            for session, session_id in zip(rows.sessions, session_ids, strict=True)
            for line in session.xp_lines
        ],
    )
    purchase_ids = [_insert_purchase(db, learner_id, purchase) for purchase in rows.purchases]
    db.execute(
        insert(GemTransaction), [_gem_row(learner_id, m, session_ids, purchase_ids) for m in rows.gem_moves]
    )
    db.execute(
        insert(ActivityDay),
        [
            {
                "user_id": learner_id,
                "local_date": day.local_date,
                "kind": day.kind,
                "goal_xp": day.goal_xp,
                "created_at": day.created_at,
            }
            for day in rows.days
        ],
    )
    for cohort in rows.cohorts:
        _insert_cohort(db, cohort)


def _insert_session(db: Session, learner_id: int, session: PlannedSession) -> int:
    """A completed session row; returns its new id."""
    return db.execute(
        insert(LessonSession)
        .values(
            user_id=learner_id,
            kind=session.kind,
            node_id=session.node_id,
            lesson_id=session.lesson_id,
            status=SessionStatus.COMPLETED,
            end_reason=EndReason.PASSED,
            rng_seed=session.rng_seed,
            started_at=session.started_at,
            last_activity_at=session.answers[-1].answered_at,
            ended_at=session.ended_at,
            mistakes=session.mistakes,
            best_combo=session.best_combo,
        )
        .returning(LessonSession.id)
    ).scalar_one()


def _insert_purchase(db: Session, learner_id: int, purchase: PlannedPurchase) -> int:
    """A purchase row; returns its new id."""
    return db.execute(
        insert(Purchase)
        .values(
            user_id=learner_id,
            shop_item_id=purchase.shop_item_id,
            price_gems=purchase.price_gems,
            idempotency_key=purchase.idempotency_key,
            purchased_at=purchase.purchased_at,
        )
        .returning(Purchase.id)
    ).scalar_one()


def _gem_row(
    learner_id: int, move: GemMove, session_ids: Sequence[int], purchase_ids: Sequence[int]
) -> dict[str, object]:
    """A gem ledger row, with the plan's session and purchase indexes replaced by their new ids."""
    return {
        "user_id": learner_id,
        "delta": move.delta,
        "balance_after": move.balance_after,
        "reason": move.reason,
        "node_id": move.node_id,
        "session_id": None if move.session_index is None else session_ids[move.session_index],
        "purchase_id": None if move.purchase_index is None else purchase_ids[move.purchase_index],
        "created_at": move.created_at,
    }


def _insert_cohort(db: Session, cohort: PlannedCohort) -> None:
    """A cohort and its memberships."""
    cohort_id = db.execute(
        insert(LeagueCohort)
        .values(
            league_tier=cohort.tier,
            week_start=cohort.week_start,
            created_at=cohort.created_at,
            finalized_at=cohort.finalized_at,
        )
        .returning(LeagueCohort.id)
    ).scalar_one()
    db.execute(
        insert(LeagueMembership),
        [
            {
                "cohort_id": cohort_id,
                "user_id": member.user_id,
                "joined_at": member.joined_at,
                "final_xp": member.final_xp,
                "final_rank": member.final_rank,
                "outcome": member.outcome,
            }
            for member in cohort.members
        ],
    )


def _write_learner(db: Session, learner_id: int, rows: SampleRows, *, now: datetime, tz: str) -> None:
    """The learner's zone and join date, daily goal, and the counters the history ends with."""
    db.execute(update(User).where(User.id == learner_id).values(timezone=tz, joined_at=rows.joined_at))
    db.execute(
        update(UserSettings)
        .where(UserSettings.user_id == learner_id)
        .values(daily_goal_xp=rows.daily_goal_xp, updated_at=now)
    )
    db.execute(
        update(UserStats)
        .where(UserStats.user_id == learner_id)
        .values(
            gems=rows.gems,
            hearts=rows.hearts.hearts,
            hearts_regen_anchor_at=rows.hearts.anchor,
            streak_current=rows.streak.current,
            streak_longest=rows.streak.longest,
            streak_last_date=rows.streak.last_date,
            streak_freezes=rows.streak.freezes,
            league_tier=rows.league_tier,
            xp_boost_until=rows.xp_boost_until,
            updated_at=now,
        )
    )


def insert_fresh_learner_rows(db: Session, user_ids: Sequence[int], now: datetime) -> None:
    """Brand-new settings and game counters (the column defaults) for each of these human learners."""
    if user_ids:
        db.execute(insert(UserSettings), [{"user_id": user_id, "updated_at": now} for user_id in user_ids])
        db.execute(insert(UserStats), [{"user_id": user_id, "updated_at": now} for user_id in user_ids])


# ---- reset ----


def reset_demo(db: Session, real_now: datetime, settings: Settings, tz: str | None = None) -> None:
    """Rebuild the demo: wipe every user's learner data, put the clock back on real time, and replay
    the sample learner's history relative to `real_now`, in `tz` (by default their current zone).

    Rows are deleted children first; tables are never dropped. Content, catalogues, bot users and bot
    profiles stay, and every human gets fresh settings and stats. Runs in the caller's transaction.
    """
    learner = user_repo.get_by_username(db, settings.default_username)
    if learner is None:
        raise NotFound(f"The learner '{settings.default_username}' doesn't exist.")
    learner_id, zone = learner.id, tz or learner.timezone
    bundle = load_bundle(DATA_DIR, default_username=settings.default_username)
    state = system_repo.get_state(db)
    if state is None or state.seed_version != bundle.version:
        # The history replays on the content in the database, which these files no longer describe.
        raise RuntimeError(
            "the seed files changed since this database was seeded: run `python -m app.seed --reset`"
        )
    db.flush()
    for table in LEARNER_TABLES:
        db.execute(delete(table))
    system_repo.mark_reseeded(db, seeded_at=real_now)
    humans = db.scalars(select(User.id).where(User.id.not_in(select(BotProfile.user_id))).order_by(User.id))
    insert_fresh_learner_rows(db, list(humans), real_now)
    apply_sample_learner_state(db, learner_id, bundle.sample_learner, now=real_now, tz=zone)
