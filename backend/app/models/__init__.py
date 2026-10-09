"""SQLAlchemy models: table shapes and constraints only, no behaviour.

Importing this package registers all 31 tables on `Base.metadata`.
"""

from app.models.auth import AuthSession
from app.models.base import Base
from app.models.content import (
    Course,
    Exercise,
    ExerciseAnswer,
    ExerciseOption,
    ExercisePair,
    GlossaryTerm,
    GuidebookPhrase,
    Lesson,
    PathNode,
    Unit,
)
from app.models.gamification import Achievement, AchievementTier, Quest, QuestClaim, ShopItem, UserAchievement
from app.models.leagues import League, LeagueCohort, LeagueMembership
from app.models.ledgers import ActivityDay, GemTransaction, Purchase, XpEvent
from app.models.play import LessonSession, SessionItem
from app.models.system import AppState
from app.models.users import BotProfile, User, UserSettings, UserStats

__all__ = [
    "Achievement",
    "AchievementTier",
    "ActivityDay",
    "AppState",
    "AuthSession",
    "Base",
    "BotProfile",
    "Course",
    "Exercise",
    "ExerciseAnswer",
    "ExerciseOption",
    "ExercisePair",
    "GemTransaction",
    "GlossaryTerm",
    "GuidebookPhrase",
    "League",
    "LeagueCohort",
    "LeagueMembership",
    "Lesson",
    "LessonSession",
    "PathNode",
    "Purchase",
    "Quest",
    "QuestClaim",
    "SessionItem",
    "ShopItem",
    "Unit",
    "User",
    "UserAchievement",
    "UserSettings",
    "UserStats",
    "XpEvent",
]
