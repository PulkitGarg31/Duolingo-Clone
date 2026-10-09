"""Course content: the ordered path, lessons, exercises with their children, the Guidebook, the glossary."""

from sqlalchemy import exists, select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.models import Course, Exercise, GlossaryTerm, GuidebookPhrase, Lesson, PathNode, Unit

# An exercise is read with all three child collections: one extra query each, instead of one query
# per exercise.
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


def course_exercises(db: Session, course_id: int) -> list[Exercise]:
    """Every exercise of a course with its options, answers and pairs, by id (read once per database)."""
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


def glossary(db: Session, course_id: int) -> list[GlossaryTerm]:
    """A course's glossary, every language: the dictionary behind the word hints and "words learned"."""
    return list(
        db.scalars(select(GlossaryTerm).where(GlossaryTerm.course_id == course_id).order_by(GlossaryTerm.id))
    )
