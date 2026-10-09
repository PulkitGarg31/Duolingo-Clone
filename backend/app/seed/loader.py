"""Load the demo data into an empty database, in a transaction that the caller commits.

The seed files are validated first, with every problem reported at once. The catalogues, the course
content, the users and the sample learner's history are then written with bulk Core statements:
each level of the content tree is one executemany that returns the new ids, in order, for the next
level. A database that already has its app_state row is left as it is.
"""

import logging
from collections.abc import Sequence
from datetime import datetime, timedelta
from typing import Any, Final

from sqlalchemy import insert
from sqlalchemy.orm import InstrumentedAttribute, Session

from app.core.config import Settings
from app.domain.enums import TextLang
from app.domain.rng import rng_for, stable_seed
from app.models import (
    Achievement,
    AchievementTier,
    AppState,
    Base,
    BotProfile,
    Course,
    Exercise,
    ExerciseAnswer,
    ExerciseOption,
    ExercisePair,
    GlossaryTerm,
    GuidebookPhrase,
    League,
    Lesson,
    PathNode,
    Quest,
    ShopItem,
    Unit,
    User,
)
from app.repositories import system_repo
from app.seed.sample_learner import apply_sample_learner_state, insert_fresh_learner_rows
from app.seed.schema import (
    CatalogFile,
    ExerciseSeed,
    FillBlankSeed,
    MatchPairsSeed,
    MultipleChoiceSeed,
    NodeSeed,
    TranslateSeed,
    TypeAnswerSeed,
    UsersFile,
    answer_tiles,
)
from app.seed.validate import DATA_DIR, LoadedCourse, data_version, load_bundle, read_files
from app.services import reference

logger = logging.getLogger(__name__)

Row = dict[str, Any]

BOT_TIMEZONE: Final = "UTC"  # bots keep no local calendar: their streak is a fixed baseline
BOT_ACCOUNT_AGE_MARGIN: Final = timedelta(days=30)  # a bot's account is older than its streak


def seed_if_empty(db: Session, real_now: datetime, settings: Settings) -> bool:
    """Seed the database unless it already holds data; True when this call seeded it.

    Everything runs in the caller's transaction: if anything fails, nothing is kept.
    """
    state = system_repo.get_state(db)
    if state is not None:
        if state.seed_version != data_version(read_files(DATA_DIR)):
            logger.warning(
                "the seed files changed since this database was seeded: run `python -m app.seed --reset`"
            )
        return False
    bundle = load_bundle(DATA_DIR, default_username=settings.default_username)
    reference.forget(db)  # nothing kept for an earlier database at this address may be reused
    insert_catalog(db, bundle.catalog)
    course_ids = insert_content(db, bundle.courses)
    learner_id = insert_users(
        db,
        bundle.users,
        course_id=course_ids[bundle.learner_course.entry.slug],
        timezone=settings.seed_timezone,
        now=real_now,
    )
    apply_sample_learner_state(db, learner_id, bundle.sample_learner, now=real_now, tz=settings.seed_timezone)
    db.execute(
        insert(AppState).values(id=system_repo.APP_STATE_ID, seeded_at=real_now, seed_version=bundle.version)
    )
    return True


# ---- catalogues ----


def insert_catalog(db: Session, catalog: CatalogFile) -> None:
    """League tiers, achievements with their levels, daily quests and shop items, in display order.

    The seed models name their fields after the columns, so most rows are the models' own fields.
    """
    _insert_all(db, League, [league.model_dump() for league in catalog.leagues])
    achievement_ids = _insert_ids(
        db,
        Achievement.id,
        [
            {**achievement.model_dump(exclude={"tiers"}), "position": position}
            for position, achievement in enumerate(catalog.achievements, start=1)
        ],
    )
    _insert_all(
        db,
        AchievementTier,
        [
            {**tier.model_dump(), "achievement_id": achievement_id}
            for achievement, achievement_id in zip(catalog.achievements, achievement_ids, strict=True)
            for tier in achievement.tiers
        ],
    )
    _insert_all(
        db,
        Quest,
        [
            {**quest.model_dump(), "position": position}
            for position, quest in enumerate(catalog.quests, start=1)
        ],
    )
    _insert_all(
        db,
        ShopItem,
        [
            {**item.model_dump(), "position": position}
            for position, item in enumerate(catalog.shop_items, start=1)
        ],
    )


# ---- course content ----


def insert_content(db: Session, courses: Sequence[LoadedCourse]) -> dict[str, int]:
    """Every course with its whole content tree. Returns the new course ids by slug."""
    course_ids = _insert_ids(
        db,
        Course.id,
        [
            {**course.entry.model_dump(exclude={"units"}), "position": position}
            for position, course in enumerate(courses, start=1)
        ],
    )
    for course, course_id in zip(courses, course_ids, strict=True):
        if course.units:
            _insert_course_tree(db, course, course_id)
    return {course.entry.slug: course_id for course, course_id in zip(courses, course_ids, strict=True)}


def _insert_course_tree(db: Session, course: LoadedCourse, course_id: int) -> None:
    """Units, then their nodes, Guidebook phrases and glossary, then lessons, exercises and children.

    Positions come from the order in the files, and exercise keys read '{node}.l{lesson}.e{exercise}'.
    """
    units = [unit.content for unit in course.units]
    unit_ids = _insert_ids(
        db,
        Unit.id,
        [
            {
                "course_id": course_id,
                "position": position,
                "title": unit.title,
                "description": unit.description,
                "color": unit.color,
                "guidebook_tips_md": unit.guidebook.tips_md,
            }
            for position, unit in enumerate(units, start=1)
        ],
    )
    _insert_all(
        db,
        GuidebookPhrase,
        [
            {"unit_id": unit_id, "position": position, "text": phrase.text, "translation": phrase.translation}
            for unit, unit_id in zip(units, unit_ids, strict=True)
            for position, phrase in enumerate(unit.guidebook.key_phrases, start=1)
        ],
    )
    nodes = [
        (unit_id, position, node)
        for unit, unit_id in zip(units, unit_ids, strict=True)
        for position, node in enumerate(unit.nodes, start=1)
    ]
    node_ids = _insert_ids(
        db,
        PathNode.id,
        [
            {
                "unit_id": unit_id,
                "position": position,
                "key": node.key,
                "kind": node.kind,
                "title": node.title,
                "chest_gems": node.chest_gems,
            }
            for unit_id, position, node in nodes
        ],
    )
    node_id_by_key = {node.key: node_id for (_, _, node), node_id in zip(nodes, node_ids, strict=True)}
    _insert_all(
        db,
        GlossaryTerm,
        [
            {
                "course_id": course_id,
                "node_id": node_id_by_key[entry.node],
                "language": TextLang(course.entry.learning_language),
                "term": entry.term,
                "hint": entry.hint,
            }
            for unit in units
            for entry in unit.glossary
        ],
    )
    _insert_lessons(db, [(node_id, node) for (_, _, node), node_id in zip(nodes, node_ids, strict=True)])


def _insert_lessons(db: Session, nodes: Sequence[tuple[int, NodeSeed]]) -> None:
    """The nodes' lessons, their exercises, and the exercises' options, answers and pairs."""
    lessons = [
        (node_id, node.key, position, lesson)
        for node_id, node in nodes
        for position, lesson in enumerate(node.lessons, start=1)
    ]
    lesson_ids = _insert_ids(
        db, Lesson.id, [{"node_id": node_id, "position": position} for node_id, _, position, _ in lessons]
    )
    exercises = [
        (lesson_id, f"{node_key}.l{lesson_position}.e{position}", position, exercise)
        for (_, node_key, lesson_position, lesson), lesson_id in zip(lessons, lesson_ids, strict=True)
        for position, exercise in enumerate(lesson.exercises, start=1)
    ]
    exercise_ids = _insert_ids(
        db,
        Exercise.id,
        [
            _exercise_row(exercise, lesson_id, position, key)
            for lesson_id, key, position, exercise in exercises
        ],
    )
    options: list[Row] = []
    answers: list[Row] = []
    pairs: list[Row] = []
    for (_, key, _, exercise), exercise_id in zip(exercises, exercise_ids, strict=True):
        options += _option_rows(exercise, exercise_id, key)
        answers += _answer_rows(exercise, exercise_id)
        pairs += _pair_rows(exercise, exercise_id)
    _insert_all(db, ExerciseOption, options)
    _insert_all(db, ExerciseAnswer, answers)
    _insert_all(db, ExercisePair, pairs)


def _exercise_row(exercise: ExerciseSeed, lesson_id: int, position: int, key: str) -> Row:
    """An exercise row; every row has the same columns, so they can share one executemany."""
    row: Row = {
        "lesson_id": lesson_id,
        "position": position,
        "key": key,
        "type": exercise.type,
        "instruction": exercise.instruction,
        "is_new_word": exercise.new_word,
        "text": None,
        "text_language": None,
        "text_translation": None,
        "audio_only": False,
    }
    match exercise:
        case MultipleChoiceSeed() | TranslateSeed():
            row |= {"text": exercise.text, "text_language": exercise.lang}
        case FillBlankSeed():
            row |= {
                "text": exercise.text,
                "text_language": exercise.lang,
                "text_translation": exercise.translation,
            }
        case TypeAnswerSeed():
            row |= {
                "text": exercise.text,
                "text_language": exercise.lang,
                "text_translation": exercise.translation,
                "audio_only": exercise.audio_only,
            }
    return row


def _option_rows(exercise: ExerciseSeed, exercise_id: int, key: str) -> list[Row]:
    """Choices, with their pictures, or a translate exercise's word-bank tiles, in a shuffled order.

    Tiles are never hand-listed: they are the primary answer's words plus the distractors, so the
    primary answer can always be built. The files list a choice exercise's correct option first.
    Both are shuffled once with a generator seeded by the exercise key, so the order is the same on
    every boot and neither an option's position nor its id tells which choice is right.
    """
    match exercise:
        case MultipleChoiceSeed():
            choices = [(option.text, option.image, option.correct) for option in exercise.options]
        case FillBlankSeed():
            choices = [(option.text, None, option.correct) for option in exercise.options]
        case TranslateSeed():
            tiles = answer_tiles(exercise.answers[0]) + list(exercise.distractors)
            choices = [(tile, None, False) for tile in tiles]
        case _:
            return []
    rng_for(key).shuffle(choices)
    return [
        {
            "exercise_id": exercise_id,
            "position": position,
            "text": text,
            "image_key": image,
            "is_correct": correct,
        }
        for position, (text, image, correct) in enumerate(choices, start=1)
    ]


def _answer_rows(exercise: ExerciseSeed, exercise_id: int) -> list[Row]:
    """Accepted answers of a typed exercise; the first is the primary."""
    if not isinstance(exercise, TranslateSeed | TypeAnswerSeed):
        return []
    return [
        {"exercise_id": exercise_id, "text": text, "is_primary": index == 0}
        for index, text in enumerate(exercise.answers)
    ]


def _pair_rows(exercise: ExerciseSeed, exercise_id: int) -> list[Row]:
    """A match exercise's pairs, in order."""
    if not isinstance(exercise, MatchPairsSeed):
        return []
    return [
        {"exercise_id": exercise_id, "position": position, "learning_text": learning, "native_text": native}
        for position, (learning, native) in enumerate(exercise.pairs, start=1)
    ]


# ---- users ----


def insert_users(db: Session, users: UsersFile, *, course_id: int, timezone: str, now: datetime) -> int:
    """The learner and the bots with their profiles. Returns the learner's id.

    The learner starts with fresh settings and stats and an unconfirmed time zone, which the first
    visit replaces with the browser's. Bots get no settings, stats or ledger rows. Neither can log in
    (no email or password: the demo learner is who a request without a token acts as), and every
    clock starts on real time.
    """
    learner = users.learner
    no_account = {"email": None, "password_hash": None, "clock_offset_seconds": 0}
    rows = [
        {
            **learner.model_dump(),
            **no_account,
            "timezone": timezone,
            "timezone_confirmed": False,
            "current_course_id": course_id,
            "joined_at": now,  # replaced by the sample learner's history
        },
        *(
            {
                **bot.model_dump(include={"username", "display_name", "avatar_color"}),
                **no_account,
                "timezone": BOT_TIMEZONE,
                "timezone_confirmed": False,
                "current_course_id": course_id,
                "joined_at": now - timedelta(days=bot.baseline_streak) - BOT_ACCOUNT_AGE_MARGIN,
            }
            for bot in users.bots
        ),
    ]
    learner_id, *bot_ids = _insert_ids(db, User.id, rows)
    _insert_all(
        db,
        BotProfile,
        [
            {
                "user_id": user_id,
                "daily_xp": bot.daily_xp,
                "rng_seed": stable_seed("bot", bot.username),
                "baseline_xp": bot.baseline_xp,
                "baseline_streak": bot.baseline_streak,
            }
            for bot, user_id in zip(users.bots, bot_ids, strict=True)
        ],
    )
    insert_fresh_learner_rows(db, [learner_id], now)
    return learner_id


# ---- bulk statements ----


def _insert_ids(db: Session, id_column: InstrumentedAttribute[int], rows: Sequence[Row]) -> list[int]:
    """Insert rows with one executemany statement; their new ids come back in the rows' order."""
    if not rows:
        return []
    statement = insert(id_column.class_).returning(id_column, sort_by_parameter_order=True)
    return list(db.scalars(statement, rows))


def _insert_all(db: Session, model: type[Base], rows: Sequence[Row]) -> None:
    """Insert rows with one executemany statement."""
    if rows:
        db.execute(insert(model), rows)
