"""Demo tools under /dev: read and move the learner's own clock, tweak the learner, reset their data."""

from datetime import date, datetime, timedelta
from typing import Literal, Self

from pydantic import Field, model_validator
from pydantic_core import PydanticCustomError

from app.domain.rules import MAX_HEARTS
from app.schemas.base import ApiModel
from app.schemas.league import LeagueResultOut
from app.schemas.me import MeOut

MIN_CLOCK_ADVANCE = timedelta(minutes=1)
MAX_CLOCK_ADVANCE = timedelta(days=60)
MAX_DEV_GEMS = 1_000_000  # keeps demo balances far from integer limits


class ClockOut(ApiModel):
    """The learner's clock: real time, their forward-only offset, and the simulated time it gives."""

    real_now: datetime
    offset_seconds: int
    now: datetime
    timezone: str
    local_now: str  # the simulated time in the learner's zone, e.g. "2026-10-09T17:30:00+05:30"
    local_date: date
    league_week_start: date
    league_week_ends_at: datetime


class ClockAdvanceIn(ApiModel):
    """Move the clock forward. The parts add up; the total must be 1 minute to 60 days."""

    minutes: int = Field(default=0, ge=0, le=MAX_CLOCK_ADVANCE // timedelta(minutes=1))
    hours: int = Field(default=0, ge=0, le=MAX_CLOCK_ADVANCE // timedelta(hours=1))
    days: int = Field(default=0, ge=0, le=MAX_CLOCK_ADVANCE.days)

    @property
    def delta(self) -> timedelta:
        """The total jump."""
        return timedelta(minutes=self.minutes, hours=self.hours, days=self.days)

    @model_validator(mode="after")
    def _within_limits(self) -> Self:
        if not MIN_CLOCK_ADVANCE <= self.delta <= MAX_CLOCK_ADVANCE:
            raise PydanticCustomError(
                "advance_out_of_range", "Advance the clock by 1 minute to 60 days in total"
            )
        return self


class SyncStreakOut(ApiModel):
    """What catching up did to the streak: freezes used, or the streak lost."""

    before: int
    after: int
    freezes_used: int
    lost: bool


class SyncEffectsOut(ApiModel):
    """What catching up to the new time changed; the client turns it into a toast."""

    hearts_gained: int
    streak: SyncStreakOut
    league_results: list[LeagueResultOut]  # league weeks of the learner finalized by the jump
    sessions_expired: int


class ClockChangeOut(ApiModel):
    """The clock after a jump and the effects of the jump."""

    clock: ClockOut
    effects: SyncEffectsOut


class DevLearnerPatchIn(ApiModel):
    """Set hearts, gems or both for a demo. Gems still move through the gem ledger."""

    hearts: int | None = Field(default=None, ge=0, le=MAX_HEARTS)
    gems: int | None = Field(default=None, ge=0, le=MAX_DEV_GEMS)

    @model_validator(mode="after")
    def _require_a_change(self) -> Self:
        if self.hearts is None and self.gems is None:
            raise PydanticCustomError("empty_patch", "Send hearts, gems or both")
        return self


class DevResetOut(ApiModel):
    """The caller after a reset: their data rebuilt and their clock back at real time."""

    reset: Literal[True] = True
    seeded_at: datetime
    me: MeOut
