"""Every game constant, in one place: this is the file to edit to tune the game.

Values follow the Duolingo web defaults. Where a constant is marked "DB CHECK", the schema builds
that constraint from the same name, so the rule and the database cannot drift apart.
Shop prices and quest rewards are catalogue data, seeded into their tables. So are each chest's gems
and the sample learner's opening balance: they live in the seed files (a unit's "chestGems", and
"startingGems" in sample_learner.json).
"""

from collections.abc import Mapping
from dataclasses import dataclass
from datetime import timedelta
from types import MappingProxyType
from typing import Final

from app.domain.enums import ExerciseType

# ---- hearts ----
MAX_HEARTS: Final = 5  # DB CHECK
DEFAULT_HEART_REGEN_MINUTES: Final = 300  # one heart per 5 h; HEART_REGEN_MINUTES overrides it
PRACTICE_HEART_REWARD: Final = 1  # per completed practice session (node or global)

# ---- XP ----
LESSON_XP: Final = 10
UNIT_REVIEW_XP: Final = 40
NODE_PRACTICE_XP: Final = 5
GLOBAL_PRACTICE_XP: Final = 10
LEGENDARY_XP: Final = 40  # paid only on a pass: a failed run earns nothing
TIMED_XP_PER_CORRECT: Final = 1
COMBO_BONUS_MAX: Final = 5  # bonus = min(5, ceil(5 * best_run / item_count))
XP_BOOST_MULTIPLIER: Final = 2  # while now < xp_boost_until; never applied to timed practice

# ---- streak and daily goal ----
MAX_STREAK_FREEZES: Final = 2  # DB CHECK
# After 365, every multiple of 100 is a milestone too.
STREAK_MILESTONES: Final[tuple[int, ...]] = (7, 14, 30, 50, 75, 100, 125, 150, 200, 250, 300, 365)
DAILY_GOAL_OPTIONS: Final[tuple[int, ...]] = (10, 20, 30, 50)  # Casual, Regular, Serious, Intense; DB CHECK
DEFAULT_DAILY_GOAL_XP: Final = 20

# ---- sessions ----
PRACTICE_ITEM_COUNT: Final = 10
PRACTICE_MISTAKE_SHARE: Final = 5  # up to 5 of the 10 items come from recent mistakes
PRACTICE_MAX_RETRIES: Final = 1  # each wrong practice item comes back once
MISTAKE_LOOKBACK: Final = timedelta(days=14)
SESSION_IDLE_TTL: Final = timedelta(hours=2)  # the sync abandons an untouched active session
LEGENDARY_ITEM_COUNT: Final = 12
LEGENDARY_MAX_MISTAKES: Final = 2  # three lives: the third mistake fails the run
LEGENDARY_PRICE_GEMS: Final = 100
TIMED_ITEM_COUNT: Final = 20
TIMED_START_SECONDS: Final = 30
# Seconds added to the timed-practice deadline per correct answer, by exercise type.
TIMED_BONUS_SECONDS: Final[Mapping[ExerciseType, int]] = MappingProxyType(
    {
        ExerciseType.MULTIPLE_CHOICE: 5,
        ExerciseType.MATCH_PAIRS: 5,
        ExerciseType.FILL_BLANK: 10,
        ExerciseType.TRANSLATE: 10,
    }
)
DEADLINE_GRACE: Final = timedelta(seconds=5)  # network allowance on the timed deadline


# ---- leagues and bots ----
@dataclass(frozen=True)
class LeagueTier:
    """One row of the league ladder: how many of a 30-member cohort move up or down each week."""

    tier: int
    name: str
    promote_count: int
    demote_count: int


LEAGUE_UNLOCK_SESSIONS: Final = 10  # completed sessions of any kind before leagues open
LEAGUE_COHORT_SIZE: Final = 30
BOTS_PER_COHORT: Final = 29
BOT_POOL_SIZE: Final = 35
LEAGUE_TIERS: Final[tuple[LeagueTier, ...]] = (
    LeagueTier(1, "Bronze", promote_count=20, demote_count=0),
    LeagueTier(2, "Silver", promote_count=15, demote_count=7),
    LeagueTier(3, "Gold", promote_count=10, demote_count=7),
    LeagueTier(4, "Sapphire", promote_count=7, demote_count=7),
    LeagueTier(5, "Ruby", promote_count=7, demote_count=7),
    LeagueTier(6, "Emerald", promote_count=7, demote_count=7),
    LeagueTier(7, "Amethyst", promote_count=7, demote_count=7),
    LeagueTier(8, "Pearl", promote_count=7, demote_count=7),
    LeagueTier(9, "Obsidian", promote_count=5, demote_count=7),
    LeagueTier(10, "Diamond", promote_count=0, demote_count=5),
)
# Multiplier on a bot's daily pace by tier: higher leagues field tougher bots.
BOT_TIER_PACE: Final[Mapping[int, float]] = MappingProxyType(
    {1: 0.5, 2: 0.8, 3: 1.0, 4: 1.15, 5: 1.3, 6: 1.45, 7: 1.6, 8: 1.75, 9: 1.9, 10: 2.1}
)
BOT_WEEK_SPREAD: Final[tuple[float, float]] = (0.6, 1.4)  # weekly XP spread around the pace
BOT_SESSION_XP: Final[tuple[int, ...]] = (10, 11, 12, 13, 14, 15, 15, 20)  # XP sizes of bot sessions

# ---- accounts ----
NEW_ACCOUNT_GEMS: Final = 500  # a new account's opening balance, booked as a `seed` gem ledger row
# Guests (private demo copies) kept at once: starting one more deletes the oldest beyond the cap.
MAX_GUESTS: Final = 500
# The colours a new account's avatar is drawn from: the ones the seeded learners and bots wear.
AVATAR_COLORS: Final[tuple[str, ...]] = (
    "#58CC02",
    "#1CB0F6",
    "#FF9600",
    "#CE82FF",
    "#FF86D0",
    "#FF4B4B",
    "#2B70C9",
    "#00CD9C",
)

# ---- grading ----
TYPO_MIN_WORD_LENGTH: Final = 4  # shorter words must be exact: el/la, un/una
SPECIAL_CHARACTERS_ES: Final[tuple[str, ...]] = ("á", "é", "í", "ó", "ú", "ñ", "ü", "¿", "¡")
