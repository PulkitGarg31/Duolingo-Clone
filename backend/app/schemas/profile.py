"""GET /users/{userId}/profile: stats and achievements of a learner or a league bot."""

from datetime import datetime

from app.domain.enums import AchievementCode
from app.schemas.base import ApiModel
from app.schemas.common import LeagueBrief


class AchievementTierOut(ApiModel):
    """One level of an achievement. `unlockedAt` is when the learner first reached it."""

    level: int
    threshold: int
    unlocked_at: datetime | None


class AchievementOut(ApiModel):
    """An achievement badge. `description` describes the next level (the last one when maxed)."""

    code: AchievementCode
    name: str
    color: str
    level: int
    max_level: int
    current_value: int
    next_threshold: int | None
    description: str
    tiers: list[AchievementTierOut]


class ProfileUser(ApiModel):
    """Whose profile this is."""

    id: int
    username: str
    display_name: str
    avatar_color: str
    joined_at: datetime
    is_me: bool
    is_bot: bool


class ProfileStats(ApiModel):
    """Profile statistics. Words, lessons and crowns are null for bots, which have no lesson history."""

    current_streak: int
    longest_streak: int
    total_xp: int
    league: LeagueBrief | None
    top_three_finishes: int
    words_learned: int | None
    lessons_completed: int | None
    crowns: int | None


class ProfileOut(ApiModel):
    """A profile page: the user, their stats and every achievement in catalogue order."""

    user: ProfileUser
    stats: ProfileStats
    achievements: list[AchievementOut]
