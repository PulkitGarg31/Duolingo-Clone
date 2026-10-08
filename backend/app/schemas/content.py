"""Public content: the course menu and a unit's Guidebook."""

from app.domain.enums import UnitColor
from app.schemas.base import ApiModel
from app.schemas.common import CourseBrief


class GuidebookUnitRef(ApiModel):
    """The unit a Guidebook belongs to."""

    id: int
    number: int
    title: str
    color: UnitColor


class KeyPhraseOut(ApiModel):
    """A Guidebook key phrase and its translation."""

    text: str
    translation: str


class GuidebookOut(ApiModel):
    """A unit's key phrases and tips. `tipsMd` uses a small Markdown subset; null means phrases only."""

    unit: GuidebookUnitRef
    tts_locale: str
    key_phrases: list[KeyPhraseOut]
    tips_md: str | None


class CoursesOut(ApiModel):
    """Every course in menu order; unpublished ones are shown as coming soon."""

    items: list[CourseBrief]
