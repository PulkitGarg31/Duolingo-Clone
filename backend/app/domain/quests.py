"""Daily quests: three per learner-local day, picked deterministically and measured from facts.

Slot 1 is always the daily-goal quest. Slots 2 and 3 are drawn from their pools by a generator
seeded with (learner, day), so the picks hold all day and change at local midnight. Nothing about
progress is stored: it is recomputed from the day's XP lines, and the service records a claim row
when it pays a reward.
"""

from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass
from datetime import date
from typing import Final

from app.domain.enums import QuestIcon, QuestMetric, XpReason
from app.domain.rng import rng_for

# The run of right answers a lesson needs to count for the "Get 5 in a row correct" quests.
IN_A_ROW: Final = 5
# A session is a "lesson" for quests when it earned one of these lines (practice and timed don't).
LESSON_REASONS: Final = frozenset({XpReason.LESSON, XpReason.REVIEW})


@dataclass(frozen=True)
class QuestDef:
    """A catalogue quest."""

    code: str
    slot: int  # 1 daily goal, 2 core, 3 hard
    title_template: str  # 'Earn {n} XP'
    metric: QuestMetric
    target: int | None  # None only for the daily-goal quest, whose target is the learner's goal
    reward_gems: int
    icon: QuestIcon


@dataclass(frozen=True)
class EarnedXp:
    """One XP line earned on the day, with the completion snapshot of the session that earned it."""

    session_id: int
    reason: XpReason
    amount: int
    mistakes: int  # of the session
    best_combo: int  # of the session


@dataclass(frozen=True)
class QuestProgress:
    """Where one of today's quests stands."""

    quest: QuestDef
    title: str
    progress: int  # capped at the target
    target: int

    @property
    def reached(self) -> bool:
        """The target is met, so the reward is due (it is paid once per quest and day)."""
        return self.progress >= self.target


def todays_quests(user_id: int, day: date, catalogue: Sequence[QuestDef]) -> list[QuestDef]:
    """The learner's three quests on `day`: the daily goal, then one random pick each from slots 2 and 3."""

    def pool(slot: int) -> list[QuestDef]:
        # Sorted by code, so the catalogue's order never changes the draw.
        return sorted((quest for quest in catalogue if quest.slot == slot), key=lambda quest: quest.code)

    rng = rng_for("quests", user_id, day.isoformat())
    return [pool(1)[0], rng.choice(pool(2)), rng.choice(pool(3))]


def quest_metrics(day_xp: Iterable[EarnedXp]) -> dict[QuestMetric, int]:
    """Every quest statistic for one day, from that day's XP lines.

    Daily-goal XP counts every line. A lesson is a session with a lesson or review line; it is
    perfect with no mistakes, and counts for the in-a-row quests with a best combo of IN_A_ROW.
    """
    lines = list(day_xp)
    lessons = {line.session_id: line for line in lines if line.reason in LESSON_REASONS}
    return {
        QuestMetric.DAILY_GOAL_XP: sum(line.amount for line in lines),
        QuestMetric.LESSONS: len(lessons),
        QuestMetric.PERFECT_LESSONS: sum(1 for line in lessons.values() if line.mistakes == 0),
        QuestMetric.COMBO_XP: sum(line.amount for line in lines if line.reason == XpReason.COMBO),
        QuestMetric.STREAK5_LESSONS: sum(1 for line in lessons.values() if line.best_combo >= IN_A_ROW),
    }


def quest_progress(quest: QuestDef, metrics: Mapping[QuestMetric, int], daily_goal_xp: int) -> QuestProgress:
    """A quest's title and progress today; the daily-goal quest's target is the learner's goal."""
    target = daily_goal_xp if quest.target is None else quest.target
    return QuestProgress(
        quest=quest,
        title=quest.title_template.format(n=target),
        progress=min(metrics[quest.metric], target),
        target=target,
    )
