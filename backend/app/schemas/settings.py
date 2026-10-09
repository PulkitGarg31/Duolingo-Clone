"""GET and PATCH /me/settings: the learner's preferences."""

from typing import Self

from pydantic import model_validator
from pydantic_core import PydanticCustomError

from app.domain.enums import Theme, TimezoneEffect
from app.schemas.base import ApiModel
from app.schemas.common import DailyGoalXp, IanaTimezone


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
    timezone: IanaTimezone | None = None

    @model_validator(mode="after")
    def _require_a_change(self) -> Self:
        if not self.changes():
            raise PydanticCustomError("empty_patch", "Send at least one setting to change")
        return self

    def changes(self) -> dict[str, object]:
        """The settings to update, keyed by field name."""
        return self.model_dump(exclude_none=True, by_alias=False)
