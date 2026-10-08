"""Shapes shared by several endpoints."""

from datetime import datetime
from typing import Literal

from app.schemas.base import ApiModel

# The daily goal options (Casual, Regular, Serious, Intense); the same values as DAILY_GOAL_OPTIONS.
DailyGoalXp = Literal[10, 20, 30, 50]


class HeartsOut(ApiModel):
    """The learner's hearts. `nextHeartAt` and `fullAt` are null while the hearts are full."""

    current: int
    max: int
    next_heart_at: datetime | None
    full_at: datetime | None
    regen_interval_seconds: int
    refill_price_gems: int


class LeagueBrief(ApiModel):
    """A league tier as badges show it."""

    tier: int
    name: str
    color: str


class CourseBrief(ApiModel):
    """A course as the course menu and the top bar show it."""

    id: int
    slug: str
    title: str
    learning_language: str
    from_language: str
    tts_locale: str
    flag_key: str
    is_published: bool
