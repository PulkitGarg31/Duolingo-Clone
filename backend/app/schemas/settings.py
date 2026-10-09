"""GET and PATCH /me/settings: the learner's preferences."""

from typing import Self

from pydantic import Field, field_validator, model_validator
from pydantic_core import PydanticCustomError

from app.domain.calendar import canonical_timezone, is_valid_timezone
from app.domain.enums import Theme, TimezoneEffect
from app.schemas.base import ApiModel
from app.schemas.common import DailyGoalXp


class SettingsOut(ApiModel):
    """The learner's preferences, plus the IANA time zone their days are counted in."""

    daily_goal_xp: DailyGoalXp
    theme: Theme
    sound_effects: bool
    animations: bool
    motivational_messages: bool
    listening_exercises: bool
    timezone: str


class SettingsUpdateOut(SettingsOut):
    """The settings after a PATCH, and what a time-zone change did: nothing, a shift of the streak
    dates, or a rebuild of the untouched sample history in the new zone."""

    timezone_effect: TimezoneEffect


class SettingsPatchIn(ApiModel):
    """A partial update: send only what changes. A null value counts as not sent."""

    daily_goal_xp: DailyGoalXp | None = None
    theme: Theme | None = None
    sound_effects: bool | None = None
    animations: bool | None = None
    motivational_messages: bool | None = None
    listening_exercises: bool | None = None
    timezone: str | None = Field(default=None, max_length=64)

    @field_validator("timezone")
    @classmethod
    def _known_timezone(cls, value: str | None) -> str | None:
        if value is not None and not is_valid_timezone(value):
            raise PydanticCustomError("unknown_timezone", "Unknown IANA time zone '{zone}'", {"zone": value})
        return None if value is None else canonical_timezone(value)

    @model_validator(mode="after")
    def _require_a_change(self) -> Self:
        if not self.changes():
            raise PydanticCustomError("empty_patch", "Send at least one setting to change")
        return self

    def changes(self) -> dict[str, object]:
        """The settings to update, keyed by field name."""
        return self.model_dump(exclude_none=True, by_alias=False)
