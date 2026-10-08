"""Public course content: the course menu and a unit's Guidebook. Neither depends on the learner."""

from sqlalchemy.orm import Session

from app.core.errors import NotFound
from app.repositories import content_repo
from app.schemas.common import CourseBrief
from app.schemas.content import CoursesOut, GuidebookOut, GuidebookUnitRef, KeyPhraseOut


def courses(db: Session) -> CoursesOut:
    """Every course in menu order; unpublished ones are shown as coming soon."""
    return CoursesOut(items=[CourseBrief.model_validate(course) for course in content_repo.list_courses(db)])


def guidebook(db: Session, unit_id: int) -> GuidebookOut:
    """A unit's key phrases (read aloud in the course's voice) and its tips."""
    unit = content_repo.get_unit_with_guidebook(db, unit_id)
    if unit is None:
        raise NotFound("There is no unit with that id.")
    return GuidebookOut(
        unit=GuidebookUnitRef(id=unit.id, number=unit.position, title=unit.title, color=unit.color),
        tts_locale=unit.course.tts_locale,
        key_phrases=[
            KeyPhraseOut(text=phrase.text, translation=phrase.translation)
            for phrase in unit.guidebook_phrases
        ],
        tips_md=unit.guidebook_tips_md,
    )
