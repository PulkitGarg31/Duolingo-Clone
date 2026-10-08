"""POST /sessions/{id}/complete: the rewards receipt behind the celebration screens."""

from datetime import date

from app.domain.enums import AchievementCode, DayState, NodeKind, SessionKind, XpReason
from app.schemas.base import ApiModel
from app.schemas.common import DailyGoalXp, LeagueBrief
from app.schemas.me import MeOut


class XpLineOut(ApiModel):
    """One XP line: the session's base XP, its combo bonus or its boost."""

    reason: XpReason
    amount: int


class CompletionXp(ApiModel):
    """The XP a completion earned, line by line."""

    total: int
    lines: list[XpLineOut]
    boost_active: bool


class StreakDayOut(ApiModel):
    """One day of the streak week strip."""

    date: date
    state: DayState


class CompletionStats(ApiModel):
    """The lesson-complete stat cards."""

    accuracy_percent: int
    duration_seconds: int
    mistakes: int
    best_combo: int
    perfect: bool
    item_count: int


class CompletionStreak(ApiModel):
    """The streak before and after; `week` is the last 7 local days ending today."""

    before: int
    after: int
    extended_today: bool
    is_new_record: bool
    milestone: bool
    week: list[StreakDayOut]


class CompletionDailyGoal(ApiModel):
    """Today's XP before and after; `justMet` when this session crossed the goal."""

    goal_xp: DailyGoalXp
    before: int
    after: int
    just_met: bool


class CompletionNode(ApiModel):
    """The node's progress after the session; `unlockedNodeIds` animate on the path."""

    id: int
    kind: NodeKind
    title: str
    lessons_completed: int
    lesson_count: int
    completed_now: bool
    legendary_now: bool
    unlocked_node_ids: list[int]


class QuestCompletedOut(ApiModel):
    """A daily quest this session completed; its gems were paid."""

    code: str
    title: str
    reward_gems: int


class AchievementUnlockOut(ApiModel):
    """The highest level of an achievement this session reached."""

    code: AchievementCode
    name: str
    level: int
    threshold: int
    description: str
    color: str


class CompletionLeague(ApiModel):
    """The learner's league standing around this session; `rankBefore` is null when they just joined."""

    joined_now: bool
    league: LeagueBrief
    weekly_xp: int
    rank_before: int | None
    rank_after: int


class TimedResultOut(ApiModel):
    """How a timed practice run went."""

    correct: int
    answered: int
    time_up: bool


class CompletionReceipt(ApiModel):
    """Everything a completion produced. It is cached for replays, so it never includes `me`."""

    session_id: int
    kind: SessionKind
    replayed: bool
    xp: CompletionXp
    stats: CompletionStats
    streak: CompletionStreak
    daily_goal: CompletionDailyGoal
    node: CompletionNode | None  # null for global practice and timed practice
    hearts_gained: int
    quests_completed: list[QuestCompletedOut]
    achievements_unlocked: list[AchievementUnlockOut]
    league: CompletionLeague | None
    timed: TimedResultOut | None
    recent_session_count: int  # completed sessions over the last 7 local days


class CompletionOut(CompletionReceipt):
    """The receipt plus a fresh `me`, built after the completion was committed."""

    me: MeOut
