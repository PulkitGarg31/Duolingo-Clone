"""String enumerations shared by the models, the API schemas and the domain rules.

Each value is exactly what is stored in the database and sent over the wire, so one change here
updates the column CHECK constraints and the API contract together.
"""

from enum import StrEnum

# ---- content ----


class TextLang(StrEnum):
    """Language of a sentence or glossary term."""

    ES = "es"
    EN = "en"


class UnitColor(StrEnum):
    """Theme colour key of a unit (the frontend maps keys to its palette)."""

    GREEN = "green"
    PURPLE = "purple"
    TEAL = "teal"
    BLUE = "blue"
    PINK = "pink"
    ORANGE = "orange"
    RED = "red"
    MAGENTA = "magenta"
    BROWN = "brown"


class NodeKind(StrEnum):
    """What a stop on the learning path is."""

    SKILL = "skill"
    CHEST = "chest"
    REVIEW = "review"


class ExerciseType(StrEnum):
    """The five exercise types. Listening is TYPE_ANSWER with audio only."""

    MULTIPLE_CHOICE = "multiple_choice"
    TRANSLATE = "translate"
    MATCH_PAIRS = "match_pairs"
    FILL_BLANK = "fill_blank"
    TYPE_ANSWER = "type_answer"


# ---- derived path state (computed, never stored) ----


class NodeState(StrEnum):
    """Display state of a path node, derived from the learner's completed sessions."""

    LOCKED = "locked"
    ACTIVE = "active"  # the one current node
    AVAILABLE = "available"  # a reachable, unopened chest
    COMPLETED = "completed"
    LEGENDARY = "legendary"


class UnitState(StrEnum):
    """Display state of a unit, derived from its nodes."""

    LOCKED = "locked"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"


# ---- play ----


class SessionKind(StrEnum):
    """The four ways to play: a path lesson, practice, a legendary run or timed practice."""

    LESSON = "lesson"
    PRACTICE = "practice"
    LEGENDARY = "legendary"
    TIMED = "timed"


class SessionStatus(StrEnum):
    """Lifecycle of a session: active until it ends exactly once."""

    ACTIVE = "active"
    COMPLETED = "completed"
    FAILED = "failed"
    ABANDONED = "abandoned"


class EndReason(StrEnum):
    """Why a session ended. Each status allows only some reasons (see the session CHECKs)."""

    PASSED = "passed"  # completed
    QUIT = "quit"  # abandoned
    OUT_OF_HEARTS = "out_of_hearts"  # failed
    TOO_MANY_MISTAKES = "too_many_mistakes"  # failed
    IDLE_TIMEOUT = "idle_timeout"  # abandoned
    SUPERSEDED = "superseded"  # abandoned


class ItemOrigin(StrEnum):
    """Whether a queue item was planned at the start or appended after a mistake."""

    INITIAL = "initial"
    RETRY = "retry"


class ItemLabel(StrEnum):
    """Badge shown above an exercise in the lesson player."""

    PREVIOUS_MISTAKE = "previous_mistake"
    NEW_WORD = "new_word"


class ItemResult(StrEnum):
    """Outcome of one answered queue item. CANT_LISTEN is neutral: neither right nor wrong."""

    CORRECT = "correct"
    INCORRECT = "incorrect"
    SKIPPED = "skipped"
    CANT_LISTEN = "cant_listen"


class GradeNote(StrEnum):
    """Extra feedback from grading: the first three on correct answers, the last two on wrong ones."""

    ALTERNATE = "alternate"
    ACCENT = "accent"
    TYPO = "typo"
    MISSING_WORD = "missing_word"
    WRONG_WORD = "wrong_word"


class RetryPolicy(StrEnum):
    """How a session kind re-asks missed exercises."""

    ALWAYS = "always"  # lesson: until answered correctly
    ONCE = "once"  # practice
    NEVER = "never"  # legendary and timed


# ---- streak and calendar ----


class StreakStatus(StrEnum):
    """Whether today's streak still needs a session."""

    INACTIVE = "inactive"
    AT_RISK = "at_risk"
    EXTENDED = "extended"


class ActivityKind(StrEnum):
    """How a stored activity day was covered."""

    ACTIVE = "active"  # a session earned XP that day
    FROZEN = "frozen"  # a Streak Freeze covered a missed day


class DayState(StrEnum):
    """A calendar day as the API shows it: an activity kind, or NONE when nothing is stored."""

    ACTIVE = "active"
    FROZEN = "frozen"
    NONE = "none"


class TimezoneEffect(StrEnum):
    """What a time-zone update did to the learner's days."""

    NONE = "none"  # same zone: only confirmed
    SHIFTED = "shifted"  # streak dates moved by the day difference between the zones
    RESEEDED = "reseeded"  # the untouched sample learner's history was rebuilt in the new zone


# ---- settings ----


class Theme(StrEnum):
    """Colour scheme preference."""

    SYSTEM = "system"
    LIGHT = "light"
    DARK = "dark"


# ---- ledgers ----


class XpReason(StrEnum):
    """One line of a session's XP; a session earns each reason at most once."""

    LESSON = "lesson"
    REVIEW = "review"
    PRACTICE = "practice"
    LEGENDARY = "legendary"
    TIMED = "timed"
    COMBO = "combo"
    BOOST = "boost"


class GemReason(StrEnum):
    """Source of a gem movement; most reasons require a foreign key to that source."""

    SEED = "seed"
    CHEST = "chest"
    QUEST = "quest"
    PURCHASE = "purchase"
    LEGENDARY_FEE = "legendary_fee"
    DEV = "dev"  # demo tools; may move gems either way


# ---- leagues ----


class LeagueZone(StrEnum):
    """Where a rank sits on the live leaderboard."""

    PROMOTION = "promotion"
    SAFE = "safe"
    DEMOTION = "demotion"


class LeagueOutcome(StrEnum):
    """Result of a finished league week."""

    PROMOTED = "promoted"
    STAYED = "stayed"
    DEMOTED = "demoted"


# ---- shop ----


class ShopItemCode(StrEnum):
    """Catalogue codes of the shop items."""

    HEART_REFILL = "heart_refill"
    UNLIMITED_HEARTS = "unlimited_hearts"
    STREAK_FREEZE = "streak_freeze"
    XP_BOOST_15 = "xp_boost_15"


class ShopItemKind(StrEnum):
    """What buying an item does."""

    HEART_REFILL = "heart_refill"
    SUPER = "super"
    STREAK_FREEZE = "streak_freeze"
    XP_BOOST = "xp_boost"


class ShopSection(StrEnum):
    """Shop page section an item is listed under."""

    HEARTS = "hearts"
    POWER_UPS = "power_ups"


# ---- quests ----


class QuestMetric(StrEnum):
    """What a daily quest counts."""

    DAILY_GOAL_XP = "daily_goal_xp"
    LESSONS = "lessons"
    PERFECT_LESSONS = "perfect_lessons"
    COMBO_XP = "combo_xp"
    STREAK5_LESSONS = "streak5_lessons"


class QuestIcon(StrEnum):
    """Icon key of a daily quest."""

    BOLT = "bolt"
    BOOK = "book"
    TARGET = "target"
    FLAME = "flame"


# ---- achievements ----


class AchievementCode(StrEnum):
    """Catalogue codes of the profile achievements."""

    WILDFIRE = "wildfire"
    SAGE = "sage"
    SCHOLAR = "scholar"
    SHARPSHOOTER = "sharpshooter"
    CHAMPION = "champion"
    WINNER = "winner"
    LEGENDARY = "legendary"


class AchievementMetric(StrEnum):
    """The learner statistic an achievement's tiers are measured against."""

    LONGEST_STREAK = "longest_streak"
    TOTAL_XP = "total_xp"
    WORDS_LEARNED = "words_learned"
    PERFECT_LESSONS = "perfect_lessons"
    HIGHEST_LEAGUE = "highest_league"
    FIRST_PLACE_FINISHES = "first_place_finishes"
    DIAMOND_WINS = "diamond_wins"
