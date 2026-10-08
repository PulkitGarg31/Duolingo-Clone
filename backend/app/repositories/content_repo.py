"""Course content: the ordered path, lessons, exercises with their children, the Guidebook, the glossary."""

from collections.abc import Collection

from sqlalchemy import exists, func, select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.domain.enums import TextLang
from app.models import Course, Exercise, GlossaryTerm, GuidebookPhrase, Lesson, PathNode, Unit

# Building an exercise's payload or grading an answer reads all three child collections, so they
# are loaded up front (one extra query each) instead of one query per exercise.
EXERCISE_CHILDREN = (
    selectinload(Exercise.options),
    selectinload(Exercise.answers),
    selectinload(Exercise.pairs),
)


def get_course(db: Session, course_id: int) -> Course | None:
    return db.get(Course, course_id)


def list_courses(db: Session) -> list[Course]:
    """Every course in menu order, published or not."""
    return list(db.scalars(select(Course).order_by(Course.position)))


def course_path(db: Session, course_id: int) -> list[Unit]:
    """A course's units in path order, each with its nodes (in order) and their lessons loaded."""
    return list(
        db.scalars(
            select(Unit)
            .where(Unit.course_id == course_id)
            .order_by(Unit.position)
            .options(selectinload(Unit.nodes).selectinload(PathNode.lessons))
        )
    )


def unit_ids_with_guidebook(db: Session, course_id: int) -> set[int]:
    """The course's units that have Guidebook content: tips or at least one key phrase."""
    has_phrases = exists().where(GuidebookPhrase.unit_id == Unit.id)
    return set(
        db.scalars(
            select(Unit.id).where(
                Unit.course_id == course_id, Unit.guidebook_tips_md.is_not(None) | has_phrases
            )
        )
    )


def get_unit_with_guidebook(db: Session, unit_id: int) -> Unit | None:
    """A unit with its key phrases (in order) and its course, whose locale reads them aloud."""
    return db.scalar(
        select(Unit)
        .where(Unit.id == unit_id)
        .options(selectinload(Unit.guidebook_phrases), joinedload(Unit.course))
    )


def get_node(db: Session, node_id: int) -> PathNode | None:
    """A path node with its unit and its lessons (in order)."""
    return db.scalar(
        select(PathNode)
        .where(PathNode.id == node_id)
        .options(joinedload(PathNode.unit), selectinload(PathNode.lessons))
    )


def lesson_at(db: Session, node_id: int, position: int) -> Lesson | None:
    """Lesson number `position` of a node, with its exercises (in authored order) and their children."""
    return db.scalar(
        select(Lesson)
        .where(Lesson.node_id == node_id, Lesson.position == position)
        .options(selectinload(Lesson.exercises).options(*EXERCISE_CHILDREN))
    )


def node_exercises(db: Session, node_id: int) -> list[Exercise]:
    """Every exercise of a node's lessons, in lesson then exercise order: the legendary pool."""
    return list(
        db.scalars(
            select(Exercise)
            .join(Lesson)
            .where(Lesson.node_id == node_id)
            .order_by(Lesson.position, Exercise.position)
            .options(*EXERCISE_CHILDREN)
        )
    )


def course_exercises(db: Session, course_id: int) -> list[Exercise]:
    """Every exercise of a course with its options, answers and pairs: the course's written vocabulary."""
    return list(
        db.scalars(
            select(Exercise)
            .join(Exercise.lesson)
            .join(Lesson.node)
            .join(PathNode.unit)
            .where(Unit.course_id == course_id)
            .order_by(Exercise.id)
            .options(*EXERCISE_CHILDREN)
        )
    )


def exercises_in_lessons(db: Session, lesson_ids: Collection[int]) -> list[Exercise]:
    """The exercises of the given lessons, by id: the practice and timed-practice pools."""
    if not lesson_ids:
        return []
    return list(
        db.scalars(
            select(Exercise)
            .where(Exercise.lesson_id.in_(lesson_ids))
            .order_by(Exercise.id)
            .options(*EXERCISE_CHILDREN)
        )
    )


def glossary(db: Session, course_id: int, language: TextLang) -> list[GlossaryTerm]:
    """A course's glossary in one language: the dictionary behind the word hints."""
    return list(
        db.scalars(
            select(GlossaryTerm)
            .where(GlossaryTerm.course_id == course_id, GlossaryTerm.language == language)
            .order_by(GlossaryTerm.id)
        )
    )


def count_glossary_terms(db: Session, course_id: int, language: TextLang, node_ids: Collection[int]) -> int:
    """How many terms the given nodes introduce; for the completed nodes, the words learned."""
    if not node_ids:
        return 0
    count = db.scalar(
        select(func.count())
        .select_from(GlossaryTerm)
        .where(
            GlossaryTerm.course_id == course_id,
            GlossaryTerm.language == language,
            GlossaryTerm.node_id.in_(node_ids),
        )
    )
    return count or 0
