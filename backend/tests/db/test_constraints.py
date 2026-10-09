"""The database is the last line of defence: every invalid write below must be refused by SQLite.

Each test starts from `world`, a small valid graph that is already committed, makes exactly one
invalid change and checks that the intended constraint is the one that fired.
"""

import re
from collections.abc import Callable
from contextlib import AbstractContextManager
from dataclasses import dataclass
from datetime import UTC, date, datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import pytest
import sqlalchemy as sa
from sqlalchemy.exc import IntegrityError, StatementError
from sqlalchemy.orm import Session

from app.core.clock import FrozenClock
from app.core.db import make_engine
from app.domain.calendar import local_date
from app.domain.enums import (
    ActivityKind,
    EndReason,
    ExerciseType,
    GemReason,
    ItemOrigin,
    ItemResult,
    NodeKind,
    QuestIcon,
    QuestMetric,
    SessionKind,
    SessionStatus,
    ShopItemKind,
    ShopSection,
    TextLang,
    UnitColor,
    XpReason,
)
from app.domain.rng import stable_seed
from app.domain.rules import LEGENDARY_PRICE_GEMS, MAX_STREAK_FREEZES
from app.models import (
    ActivityDay,
    AppState,
    Base,
    Course,
    Exercise,
    ExerciseAnswer,
    ExerciseOption,
    ExercisePair,
    GemTransaction,
    GlossaryTerm,
    League,
    LeagueCohort,
    Lesson,
    LessonSession,
    PathNode,
    Purchase,
    Quest,
    QuestClaim,
    SessionItem,
    ShopItem,
    Unit,
    User,
    UserSettings,
    UserStats,
    XpEvent,
)

ANCHOR = datetime(2026, 10, 8, 10, 0, tzinfo=UTC)  # a heart-regeneration anchor two hours ago
CHEST_GEMS = 20  # what a chest holds in the seed files


@dataclass
class World:
    """One course whose unit holds a skill, a review and a chest; exercises with their child rows;
    the Bronze league; and one human learner with settings and stats."""

    now: datetime
    course: Course
    skill: PathNode
    review: PathNode
    chest: PathNode
    lesson: Lesson  # the skill's only lesson
    choice: Exercise  # multiple choice: one correct option of two
    translate: Exercise  # one primary accepted answer and one alternate
    match: Exercise  # one pair
    learner: User
    stats: UserStats


@pytest.fixture
def world(db: Session, clock: FrozenClock) -> World:
    now = clock.now()
    course = Course(
        slug="es-en",
        title="Spanish",
        learning_language="es",
        from_language="en",
        tts_locale="es-ES",
        flag_key="es",
        position=1,
    )
    unit = Unit(
        course=course, position=1, title="Greet people", description="Say hello.", color=UnitColor.GREEN
    )
    skill = PathNode(
        unit=unit, position=1, key="u1.hola", kind=NodeKind.SKILL, title="Hola", lessons=[Lesson(position=1)]
    )
    review = PathNode(
        unit=unit,
        position=2,
        key="u1.review",
        kind=NodeKind.REVIEW,
        title="Review",
        lessons=[Lesson(position=1)],
    )
    chest = PathNode(
        unit=unit, position=3, key="u1.chest", kind=NodeKind.CHEST, title="Chest", chest_gems=CHEST_GEMS
    )
    lesson = skill.lessons[0]
    choice = Exercise(
        lesson=lesson,
        position=1,
        key="u1.hola.l1.e1",
        type=ExerciseType.MULTIPLE_CHOICE,
        instruction="Which one means “hello”?",
        options=[
            ExerciseOption(position=1, text="hola", is_correct=True),
            ExerciseOption(position=2, text="adiós"),
        ],
    )
    translate = Exercise(
        lesson=lesson,
        position=2,
        key="u1.hola.l1.e2",
        type=ExerciseType.TRANSLATE,
        instruction="Translate this sentence",
        text="Hola",
        text_language=TextLang.ES,
        answers=[ExerciseAnswer(text="Hello", is_primary=True), ExerciseAnswer(text="Hi")],
    )
    match = Exercise(
        lesson=lesson,
        position=3,
        key="u1.hola.l1.e3",
        type=ExerciseType.MATCH_PAIRS,
        instruction="Tap the matching pairs",
        pairs=[ExercisePair(position=1, learning_text="el pan", native_text="the bread")],
    )
    db.add_all([course, League(tier=1, name="Bronze", color="#CD7F32", promote_count=20, demote_count=0)])
    db.flush()

    stats = UserStats(updated_at=now)
    learner = User(
        username="alex",
        display_name="Alex",
        avatar_color="#1CB0F6",
        timezone="Asia/Kolkata",
        current_course_id=course.id,
        joined_at=now,
        settings=UserSettings(updated_at=now),
        stats=stats,
    )
    db.add(learner)
    db.commit()
    return World(now, course, skill, review, chest, lesson, choice, translate, match, learner, stats)


# ---- helpers ----


def check_fails(constraint: str) -> AbstractContextManager[pytest.ExceptionInfo[IntegrityError]]:
    """Expect the write to be refused by the named CHECK constraint."""
    return pytest.raises(IntegrityError, match=rf"CHECK constraint failed: {re.escape(constraint)}(?!\w)")


def unique_fails(*columns: str) -> AbstractContextManager[pytest.ExceptionInfo[IntegrityError]]:
    """Expect the write to be refused by a UNIQUE constraint or unique index over exactly these columns."""
    message = re.escape(f"UNIQUE constraint failed: {', '.join(columns)}")
    return pytest.raises(IntegrityError, match=rf"{message}(?![\w,])")


def foreign_key_fails() -> AbstractContextManager[pytest.ExceptionInfo[IntegrityError]]:
    return pytest.raises(IntegrityError, match="FOREIGN KEY constraint failed")


def lesson_session(world: World, **columns: object) -> LessonSession:
    """An active lesson session on the world's lesson, with any column overridden."""
    values: dict[str, object] = {
        "user_id": world.learner.id,
        "kind": SessionKind.LESSON,
        "node_id": world.skill.id,
        "lesson_id": world.lesson.id,
        "rng_seed": stable_seed(world.learner.id, SessionKind.LESSON, world.skill.id, world.now.isoformat()),
        "started_at": world.now,
        "last_activity_at": world.now,
    }
    return LessonSession(**(values | columns))


def completed_session(world: World, **columns: object) -> LessonSession:
    """A lesson session as the completion compare-and-set statement leaves it."""
    completed: dict[str, object] = {
        "status": SessionStatus.COMPLETED,
        "end_reason": EndReason.PASSED,
        "ended_at": world.now,
        "mistakes": 0,
        "best_combo": 3,
    }
    return lesson_session(world, **(completed | columns))


def xp_line(world: World, session: LessonSession, reason: XpReason, amount: int) -> XpEvent:
    return XpEvent(
        user_id=world.learner.id,
        session_id=session.id,
        reason=reason,
        amount=amount,
        earned_at=world.now,
        local_date=local_date(world.now, world.learner.timezone),
    )


def gem_row(
    world: World, reason: GemReason, *, delta: int, balance_after: int, **sources: int
) -> GemTransaction:
    return GemTransaction(
        user_id=world.learner.id,
        reason=reason,
        delta=delta,
        balance_after=balance_after,
        created_at=world.now,
        **sources,
    )


def count(db: Session, model: type[Base]) -> int:
    return db.execute(sa.select(sa.func.count()).select_from(model)).scalar_one()


# ---- connection and naming conventions ----


def test_every_connection_enforces_foreign_keys_and_uses_wal(db: Session) -> None:
    names = ("foreign_keys", "journal_mode", "synchronous", "busy_timeout")
    values = {name: db.execute(sa.text(f"PRAGMA {name}")).scalar_one() for name in names}
    assert values == {"foreign_keys": 1, "journal_mode": "wal", "synchronous": 1, "busy_timeout": 5000}


def test_the_engine_creates_the_folder_of_a_new_database(tmp_path: Path) -> None:
    # SQLite creates a missing file but not a missing folder ("unable to open database file").
    database = tmp_path / "fresh" / "data" / "app.db"
    engine = make_engine(f"sqlite:///{database.as_posix()}")
    try:
        with engine.connect() as conn:
            assert conn.exec_driver_sql("PRAGMA journal_mode").scalar_one() == "wal"
    finally:
        engine.dispose()
    assert database.is_file()


def test_every_check_constraint_is_named_after_its_table(db: Session) -> None:
    problems = []
    for table, ddl in db.execute(sa.text("SELECT name, sql FROM sqlite_master WHERE type = 'table'")):
        names = re.findall(r"CONSTRAINT (\w+) CHECK", ddl)
        if len(names) != ddl.count("CHECK ("):
            problems.append(f"{table}: unnamed CHECK")
        problems += [f"{table}: {name}" for name in names if not name.startswith(f"ck_{table}_")]
    assert problems == []


# ---- user_stats: hearts, gems, streak ----


@pytest.mark.parametrize(
    ("changes", "constraint"),
    [
        pytest.param(
            {"hearts": 6, "hearts_regen_anchor_at": ANCHOR}, "ck_user_stats_hearts_range", id="six-hearts"
        ),
        pytest.param({"hearts": 4}, "ck_user_stats_hearts_anchor", id="missing-heart-without-anchor"),
        pytest.param(
            {"hearts_regen_anchor_at": ANCHOR}, "ck_user_stats_hearts_anchor", id="full-hearts-with-anchor"
        ),
        pytest.param({"gems": -1}, "ck_user_stats_gems_non_negative", id="negative-gems"),
        pytest.param(
            {"streak_freezes": MAX_STREAK_FREEZES + 1}, "ck_user_stats_freezes_range", id="extra-freeze"
        ),
        pytest.param(
            {"streak_last_date": date(2026, 10, 7)},
            "ck_user_stats_streak_date_iff_alive",
            id="no-streak-with-date",
        ),
        pytest.param(
            {"streak_current": 3, "streak_longest": 3},
            "ck_user_stats_streak_date_iff_alive",
            id="streak-without-date",
        ),
    ],
)
def test_user_stats_refuse_impossible_states(
    db: Session, world: World, changes: dict[str, object], constraint: str
) -> None:
    for column, value in changes.items():
        setattr(world.stats, column, value)
    with check_fails(constraint):
        db.flush()


# ---- lesson_sessions ----


def test_a_learner_has_at_most_one_active_session(db: Session, world: World) -> None:
    db.add(lesson_session(world))
    db.flush()
    db.add(lesson_session(world, kind=SessionKind.PRACTICE, lesson_id=None))
    with unique_fails("lesson_sessions.user_id"):
        db.flush()


def test_ended_sessions_leave_the_active_slot_free(db: Session, world: World) -> None:
    db.add_all([completed_session(world), completed_session(world), lesson_session(world)])
    db.flush()
    assert count(db, LessonSession) == 3


def test_a_lesson_session_must_name_its_lessons_node(db: Session, world: World) -> None:
    db.add(lesson_session(world, node_id=world.review.id))  # the lesson belongs to the skill
    with foreign_key_fails():
        db.flush()


def test_a_session_without_a_lesson_skips_the_composite_key(db: Session, world: World) -> None:
    # MATCH SIMPLE: a NULL lesson_id switches the composite foreign key off; node_id keeps its own.
    db.add(lesson_session(world, kind=SessionKind.PRACTICE, node_id=world.review.id, lesson_id=None))
    db.flush()


def test_a_completed_session_must_have_passed(db: Session, world: World) -> None:
    db.add(completed_session(world, end_reason=EndReason.QUIT))
    with check_fails("ck_lesson_sessions_completed_reason"):
        db.flush()


def test_an_active_session_has_no_end_time(db: Session, world: World) -> None:
    db.add(lesson_session(world, ended_at=world.now))
    with check_fails("ck_lesson_sessions_active_no_end"):
        db.flush()


@pytest.mark.parametrize(
    ("columns", "constraint"),
    [
        pytest.param({"lesson_id": None}, "ck_lesson_sessions_lesson_iff_kind", id="lesson-without-lesson"),
        pytest.param(
            {"kind": SessionKind.TIMED, "node_id": None, "lesson_id": None},
            "ck_lesson_sessions_deadline_iff_timed",
            id="timed-without-deadline",
        ),
        pytest.param(
            {"kind": SessionKind.LEGENDARY, "node_id": None, "lesson_id": None},
            "ck_lesson_sessions_node_required",
            id="legendary-without-node",
        ),
    ],
)
def test_each_session_kind_has_its_own_shape(
    db: Session, world: World, columns: dict[str, object], constraint: str
) -> None:
    db.add(lesson_session(world, **columns))
    with check_fails(constraint):
        db.flush()


def test_completion_sets_status_reason_and_end_time_in_one_statement(db: Session, world: World) -> None:
    session = lesson_session(world)
    db.add(session)
    db.commit()
    complete = sa.update(LessonSession).where(
        LessonSession.id == session.id, LessonSession.status == SessionStatus.ACTIVE
    )

    # SQLite checks constraints per statement: a new status without its end time is refused...
    with check_fails("ck_lesson_sessions_active_no_end"):
        db.execute(complete.values(status=SessionStatus.COMPLETED, end_reason=EndReason.PASSED))
    db.rollback()

    # ...while the compare-and-set statement that writes all three columns succeeds, exactly once.
    finished = complete.values(
        status=SessionStatus.COMPLETED,
        end_reason=EndReason.PASSED,
        ended_at=world.now,
        mistakes=0,
        best_combo=3,
    )
    assert db.execute(finished).rowcount == 1
    assert db.execute(finished).rowcount == 0


# ---- exercises and their child rows ----


def test_an_exercise_has_at_most_one_correct_choice(db: Session, world: World) -> None:
    world.choice.options.append(ExerciseOption(position=3, text="hello", is_correct=True))
    with unique_fails("exercise_options.exercise_id"):
        db.flush()


def test_an_exercise_has_at_most_one_primary_answer(db: Session, world: World) -> None:
    world.translate.answers.append(ExerciseAnswer(text="Hello there", is_primary=True))
    with unique_fails("exercise_answers.exercise_id"):
        db.flush()


@pytest.mark.parametrize("side", ["learning_text", "native_text"])
def test_each_side_of_a_pair_is_unique_within_its_exercise(db: Session, world: World, side: str) -> None:
    pair = ExercisePair(position=2, learning_text="el agua", native_text="the water")
    setattr(pair, side, getattr(world.match.pairs[0], side))
    world.match.pairs.append(pair)
    with unique_fails("exercise_pairs.exercise_id", f"exercise_pairs.{side}"):
        db.flush()


def test_audio_only_is_reserved_for_spanish_type_answer(db: Session, world: World) -> None:
    world.translate.audio_only = True
    with check_fails("ck_exercises_audio_only_listening"):
        db.flush()


def test_a_fill_in_the_blank_sentence_contains_the_blank(db: Session, world: World) -> None:
    world.lesson.exercises.append(
        Exercise(
            position=4,
            key="u1.hola.l1.e4",
            type=ExerciseType.FILL_BLANK,
            instruction="Fill in the blank",
            text="Yo bebo agua.",
            text_language=TextLang.ES,
        )
    )
    with check_fails("ck_exercises_blank_present"):
        db.flush()


# ---- ledgers ----


def test_a_session_earns_each_xp_reason_once(db: Session, world: World) -> None:
    session = completed_session(world)
    db.add(session)
    db.flush()
    db.add_all([xp_line(world, session, XpReason.LESSON, 10), xp_line(world, session, XpReason.LESSON, 10)])
    with unique_fails("xp_events.session_id", "xp_events.reason"):
        db.flush()


def test_an_xp_line_is_positive(db: Session, world: World) -> None:
    session = completed_session(world)
    db.add(session)
    db.flush()
    db.add(xp_line(world, session, XpReason.LESSON, 0))
    with check_fails("ck_xp_events_amount_positive"):
        db.flush()


def test_a_gem_balance_never_goes_below_zero(db: Session, world: World) -> None:
    db.add(gem_row(world, GemReason.DEV, delta=-5, balance_after=-5))
    with check_fails("ck_gem_transactions_balance_non_negative"):
        db.flush()


def test_a_chest_reward_names_its_chest(db: Session, world: World) -> None:
    db.add(gem_row(world, GemReason.CHEST, delta=CHEST_GEMS, balance_after=CHEST_GEMS))
    with check_fails("ck_gem_transactions_chest_source"):
        db.flush()


def test_a_chest_pays_out_once(db: Session, world: World) -> None:
    chest = world.chest.id
    db.add(gem_row(world, GemReason.CHEST, delta=CHEST_GEMS, balance_after=CHEST_GEMS, node_id=chest))
    db.flush()
    db.add(gem_row(world, GemReason.CHEST, delta=CHEST_GEMS, balance_after=2 * CHEST_GEMS, node_id=chest))
    with unique_fails("gem_transactions.user_id", "gem_transactions.node_id"):
        db.flush()


# A quest claim, a purchase and a legendary session each move gems exactly once: partial unique
# indexes back the replay paths of quest rewards, shop purchases and the legendary entry fee.


def quest_claim_source(db: Session, world: World) -> int:
    quest = Quest(
        code="daily_goal",
        slot=1,
        title_template="Earn {n} XP",
        metric=QuestMetric.DAILY_GOAL_XP,
        reward_gems=10,
        icon=QuestIcon.BOLT,
        position=1,
    )
    db.add(quest)
    db.flush()
    claim = QuestClaim(
        user_id=world.learner.id,
        quest_id=quest.id,
        local_date=local_date(world.now, world.learner.timezone),
        claimed_at=world.now,
    )
    db.add(claim)
    db.flush()
    return claim.id


def purchase_source(db: Session, world: World) -> int:
    item = ShopItem(
        code="streak_freeze",
        kind=ShopItemKind.STREAK_FREEZE,
        section=ShopSection.POWER_UPS,
        name="Streak Freeze",
        description="Keeps your streak if you miss a day.",
        price_gems=200,
        position=1,
    )
    db.add(item)
    db.flush()
    purchase = Purchase(
        user_id=world.learner.id,
        shop_item_id=item.id,
        price_gems=item.price_gems,
        idempotency_key="9b2f6c1e-3d4a-4f5b-8c7d-0e1f2a3b4c5d",
        purchased_at=world.now,
    )
    db.add(purchase)
    db.flush()
    return purchase.id


def legendary_session_source(db: Session, world: World) -> int:
    session = lesson_session(world, kind=SessionKind.LEGENDARY, lesson_id=None)
    db.add(session)
    db.flush()
    return session.id


@pytest.mark.parametrize(
    ("reason", "delta", "source_column", "make_source"),
    [
        pytest.param(GemReason.QUEST, 10, "quest_claim_id", quest_claim_source, id="quest-reward"),
        pytest.param(GemReason.PURCHASE, -200, "purchase_id", purchase_source, id="purchase"),
        pytest.param(
            GemReason.LEGENDARY_FEE,
            -LEGENDARY_PRICE_GEMS,
            "session_id",
            legendary_session_source,
            id="legendary-fee",
        ),
    ],
)
def test_each_gem_source_is_booked_once(
    db: Session,
    world: World,
    reason: GemReason,
    delta: int,
    source_column: str,
    make_source: Callable[[Session, World], int],
) -> None:
    source = {source_column: make_source(db, world)}
    db.add(gem_row(world, reason, delta=delta, balance_after=1000, **source))
    db.flush()
    db.add(gem_row(world, reason, delta=delta, balance_after=1000, **source))
    with unique_fails(f"gem_transactions.{source_column}"):
        db.flush()


def test_a_frozen_day_records_no_goal(db: Session, world: World) -> None:
    db.add(
        ActivityDay(
            user_id=world.learner.id,
            local_date=date(2026, 10, 7),
            kind=ActivityKind.FROZEN,
            goal_xp=20,
            created_at=world.now,
        )
    )
    with check_fails("ck_activity_days_goal_iff_active"):
        db.flush()


# ---- leagues and global state ----


def test_a_league_week_starts_on_a_monday(db: Session, world: World) -> None:
    db.add(LeagueCohort(league_tier=1, week_start=date(2026, 10, 5), created_at=world.now))  # Monday
    db.flush()
    db.add(LeagueCohort(league_tier=1, week_start=date(2026, 10, 6), created_at=world.now))  # Tuesday
    with check_fails("ck_league_cohorts_week_starts_monday"):
        db.flush()


def test_app_state_is_a_single_row(db: Session, world: World) -> None:
    db.add(AppState(id=1, seeded_at=world.now, seed_version="v1"))
    db.flush()
    db.add(AppState(id=2, seeded_at=world.now, seed_version="v1"))
    with check_fails("ck_app_state_single_row"):
        db.flush()


def test_the_clock_offset_never_goes_negative(db: Session, world: World) -> None:
    db.add(AppState(id=1, clock_offset_seconds=-1, seeded_at=world.now, seed_version="v1"))
    with check_fails("ck_app_state_offset_forward_only"):
        db.flush()


# ---- enum and boolean columns, below the ORM ----


@pytest.mark.parametrize(
    ("statement", "constraint"),
    [
        pytest.param(
            "UPDATE path_nodes SET kind = 'boss' WHERE key = 'u1.hola'", "ck_path_nodes_kind", id="enum"
        ),
        pytest.param(
            "UPDATE exercise_options SET is_correct = 2", "ck_exercise_options_is_correct", id="boolean"
        ),
        pytest.param(
            "UPDATE user_settings SET daily_goal_xp = 15", "ck_user_settings_daily_goal_xp", id="goal"
        ),
    ],
)
def test_columns_refuse_values_outside_their_domain(
    db: Session, world: World, statement: str, constraint: str
) -> None:
    with check_fails(constraint):
        db.execute(sa.text(statement))


# ---- ON DELETE: cascade inside an aggregate, restrict across aggregates ----


def test_played_content_cannot_be_deleted(db: Session, world: World) -> None:
    item = SessionItem(seq=1, exercise_id=world.choice.id, origin=ItemOrigin.INITIAL)
    db.add(lesson_session(world, items=[item]))
    db.commit()
    with foreign_key_fails():
        db.execute(sa.delete(Exercise).where(Exercise.id == world.choice.id))


def test_unplayed_content_cascades_and_glossary_links_are_cleared(db: Session, world: World) -> None:
    term = GlossaryTerm(
        course_id=world.course.id, node_id=world.review.id, language=TextLang.ES, term="hola", hint="hi"
    )
    db.add(term)
    db.commit()

    db.execute(sa.delete(PathNode).where(PathNode.id == world.review.id))
    db.commit()

    lessons_left = sa.select(sa.func.count()).select_from(Lesson).where(Lesson.node_id == world.review.id)
    assert db.scalar(lessons_left) == 0
    db.refresh(term)
    assert term.node_id is None  # the word stays in the course glossary, unlinked


def test_deleting_a_user_removes_everything_they_own(db: Session, world: World) -> None:
    answered = SessionItem(
        seq=1,
        exercise_id=world.choice.id,
        origin=ItemOrigin.INITIAL,
        result=ItemResult.CORRECT,
        submitted_json='{"type":"multiple_choice","optionId":1}',
        answered_at=world.now,
    )
    session = completed_session(world, items=[answered])
    db.add(session)
    db.flush()
    db.add_all(
        [
            xp_line(world, session, XpReason.LESSON, 10),
            gem_row(world, GemReason.SEED, delta=100, balance_after=100),
            ActivityDay(
                user_id=world.learner.id,
                local_date=local_date(world.now, world.learner.timezone),
                kind=ActivityKind.ACTIVE,
                goal_xp=20,
                created_at=world.now,
            ),
        ]
    )
    db.commit()

    db.execute(sa.delete(User).where(User.id == world.learner.id))
    db.commit()

    owned = (UserSettings, UserStats, LessonSession, SessionItem, XpEvent, GemTransaction, ActivityDay)
    assert {model.__tablename__: count(db, model) for model in owned} == {m.__tablename__: 0 for m in owned}
    assert count(db, Exercise) == 3  # content is a different aggregate: untouched


# ---- column types ----


def test_naive_datetimes_are_refused_before_reaching_the_database(db: Session, world: World) -> None:
    world.stats.updated_at = datetime(2026, 10, 8, 12, 0)  # noqa: DTZ001 - deliberately naive
    with pytest.raises(StatementError, match="naive datetime"):
        db.flush()


def test_instants_are_stored_as_utc_and_read_back_aware(db: Session, world: World) -> None:
    world.stats.updated_at = datetime(2026, 10, 8, 17, 30, tzinfo=ZoneInfo("Asia/Kolkata"))
    db.commit()
    stored = db.execute(sa.text("SELECT updated_at FROM user_stats")).scalar_one()
    assert stored == "2026-10-08 12:00:00.000000"  # naive UTC text, which sorts chronologically

    db.expire(world.stats)
    assert world.stats.updated_at == datetime(2026, 10, 8, 12, 0, tzinfo=UTC)
    assert world.stats.updated_at.tzinfo is UTC


def test_enums_are_stored_as_their_values(db: Session, world: World) -> None:
    assert db.execute(sa.text("SELECT kind FROM path_nodes WHERE key = 'u1.chest'")).scalar_one() == "chest"
    db.expire(world.chest)
    assert world.chest.kind is NodeKind.CHEST


def test_stable_seeds_fit_the_integer_columns_that_store_them(db: Session, world: World) -> None:
    seeds = [stable_seed("bot", f"bot{i}") for i in range(1000)]
    assert all(0 <= seed < 2**63 for seed in seeds)

    db.add(lesson_session(world, rng_seed=max(seeds)))
    db.commit()
    assert db.scalar(sa.select(LessonSession.rng_seed)) == max(seeds)
