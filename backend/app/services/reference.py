"""Reference data: the course content and the catalogues, read from the database once and then reused.

The seed writes these rows and nothing changes them while the server runs (the demo reset rewrites
learner data only). So each part is read the first time a request needs it, copied into the frozen
dataclasses of domain/content.py and domain/catalog.py, and kept for the next requests on the same
database. Frozen copies, never ORM objects: requests on different threads share them, while an ORM
object belongs to the one session that loaded it.

Seeding a database drops what was kept for it. A database rebuilt underneath a running server by
another process (`python -m app.seed --reset` with changed seed files) needs a server restart.
"""

import threading
from collections import OrderedDict, defaultdict
from collections.abc import Callable
from types import MappingProxyType
from typing import Final, cast

from sqlalchemy.orm import Session

from app.domain.achievements import AchievementDef, AchievementTierDef
from app.domain.catalog import Catalog, LeagueRow, QuestRow, ShopItemRow
from app.domain.content import (
    CourseContent,
    CourseRow,
    ExerciseRow,
    GlossaryTermRow,
    LessonRow,
    NodeRow,
    OptionRow,
    PairRow,
    UnitRow,
)
from app.domain.enums import AchievementCode, QuestIcon
from app.domain.quests import QuestDef
from app.models import Achievement, Exercise, Quest
from app.repositories import content_repo, gamification_repo, league_repo

# Production uses one database; tests open one per test, so only the most recent few are kept.
_MAX_DATABASES: Final = 4
_kept: OrderedDict[str, dict[str, object]] = OrderedDict()  # database URL -> part name -> value
_lock = threading.Lock()  # requests run on a thread pool


def catalog(db: Session) -> Catalog:
    """The league tiers, achievements, daily quests and shop items of this database."""
    return _reuse(db, "catalog", lambda: _load_catalog(db))


def course_content(db: Session, course_id: int) -> CourseContent:
    """One course's path, exercises and glossary."""
    return _reuse(db, f"course {course_id}", lambda: _load_course(db, course_id))


def forget(db: Session) -> None:
    """Drop everything kept for this database: the seed calls it before writing new content."""
    with _lock:
        _kept.pop(str(db.get_bind().url), None)


def warm(db: Session) -> None:
    """Read every part now, so that the first requests after a boot don't pay for it.

    Only published courses have content; the others are listed as coming soon.
    """
    catalog(db)
    for course in content_repo.list_courses(db):
        if course.is_published:
            _ = course_content(db, course.id).vocabulary  # built on first use, so built here


def _reuse[T](db: Session, part: str, build: Callable[[], T]) -> T:
    """The value kept for `part` of this database, built on first use."""
    url = str(db.get_bind().url)
    with _lock:
        parts = _kept.setdefault(url, {})
        _kept.move_to_end(url)
        while len(_kept) > _MAX_DATABASES:
            _kept.popitem(last=False)
        if part in parts:
            return cast(T, parts[part])
    value = build()  # outside the lock: two threads may both build it once, with equal results
    with _lock:
        parts[part] = value
    return value


# ---- reading the rows once ----


def _load_catalog(db: Session) -> Catalog:
    leagues = {
        row.tier: LeagueRow(row.tier, row.name, row.color, row.promote_count, row.demote_count)
        for row in league_repo.leagues(db)
    }
    shop_items = tuple(
        ShopItemRow(
            id=row.id,
            code=row.code,
            kind=row.kind,
            section=row.section,
            name=row.name,
            description=row.description,
            price_gems=row.price_gems,
            duration_minutes=row.duration_minutes,
            is_available=row.is_available,
        )
        for row in gamification_repo.shop_items(db)
    )
    return Catalog(
        leagues=MappingProxyType(leagues),
        achievements=tuple(_achievement(row) for row in gamification_repo.achievements(db)),
        quests=tuple(QuestRow(row.id, _quest(row)) for row in gamification_repo.quests(db)),
        shop_items=shop_items,
    )


def _achievement(row: Achievement) -> AchievementDef:
    return AchievementDef(
        code=AchievementCode(row.code),
        name=row.name,
        metric=row.metric,
        description_template=row.description_template,
        color=row.color,
        tiers=tuple(
            AchievementTierDef(tier.id, tier.level, tier.threshold, tier.description) for tier in row.tiers
        ),
    )


def _quest(row: Quest) -> QuestDef:
    return QuestDef(
        code=row.code,
        slot=row.slot,
        title_template=row.title_template,
        metric=row.metric,
        target=row.target,
        reward_gems=row.reward_gems,
        icon=QuestIcon(row.icon),
    )


def _load_course(db: Session, course_id: int) -> CourseContent:
    course = content_repo.get_course(db, course_id)
    if course is None:  # users.current_course_id is a foreign key
        raise RuntimeError(f"course {course_id} is missing")
    rows = content_repo.course_exercises(db, course_id)  # with their options, answers and pairs
    in_lesson: defaultdict[int, list[Exercise]] = defaultdict(list)
    for row in sorted(rows, key=lambda row: row.position):
        in_lesson[row.lesson_id].append(row)
    with_guidebook = content_repo.unit_ids_with_guidebook(db, course_id)
    units = tuple(
        UnitRow(
            id=unit.id,
            position=unit.position,
            section=unit.section,
            title=unit.title,
            description=unit.description,
            color=unit.color,
            has_guidebook=unit.id in with_guidebook,
            nodes=tuple(
                NodeRow(
                    id=node.id,
                    unit_id=unit.id,
                    unit_number=unit.position,
                    unit_color=unit.color,
                    position=node.position,
                    key=node.key,
                    kind=node.kind,
                    title=node.title,
                    chest_gems=node.chest_gems,
                    lessons=tuple(
                        LessonRow(lesson.id, lesson.position, tuple(row.id for row in in_lesson[lesson.id]))
                        for lesson in node.lessons
                    ),
                )
                for node in unit.nodes
            ),
        )
        for unit in content_repo.course_path(db, course_id)
    )
    terms = tuple(
        GlossaryTermRow(term.language, term.term, term.hint, term.node_id)
        for term in content_repo.glossary(db, course_id)
    )
    return CourseContent(
        course=CourseRow(
            id=course.id,
            slug=course.slug,
            title=course.title,
            learning_language=course.learning_language,
            from_language=course.from_language,
            tts_locale=course.tts_locale,
            flag_key=course.flag_key,
            is_published=course.is_published,
        ),
        units=units,
        exercises=MappingProxyType({row.id: _exercise_row(row) for row in rows}),  # rows come in id order
        terms=terms,
    )


def _exercise_row(exercise: Exercise) -> ExerciseRow:
    return ExerciseRow(
        id=exercise.id,
        lesson_id=exercise.lesson_id,
        type=exercise.type,
        instruction=exercise.instruction,
        text=exercise.text,
        text_language=exercise.text_language,
        text_translation=exercise.text_translation,
        audio_only=exercise.audio_only,
        is_new_word=exercise.is_new_word,
        options=tuple(
            OptionRow(option.id, option.text, option.image_key, option.is_correct)
            for option in exercise.options
        ),
        answers=tuple(answer.text for answer in exercise.answers),  # the relationship puts the primary first
        pairs=tuple(PairRow(pair.id, pair.learning_text, pair.native_text) for pair in exercise.pairs),
    )
