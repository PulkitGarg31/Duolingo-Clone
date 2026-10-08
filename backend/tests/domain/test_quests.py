"""Daily quests: the deterministic daily pick and the statistics measured from the day's XP lines."""

from datetime import date, timedelta

import pytest

from app.domain.enums import QuestIcon, QuestMetric, XpReason
from app.domain.quests import EarnedXp, QuestDef, QuestProgress, quest_metrics, quest_progress, todays_quests

Metric, Icon = QuestMetric, QuestIcon
IN_A_ROW = "Get 5 in a row correct in {n} lessons"
DAILY_GOAL = QuestDef("daily_goal", 1, "Earn {n} XP", Metric.DAILY_GOAL_XP, None, 10, Icon.BOLT)
CATALOGUE = (
    DAILY_GOAL,
    QuestDef("lessons_2", 2, "Complete {n} lessons", Metric.LESSONS, 2, 10, Icon.BOOK),
    QuestDef("perfect_1", 2, "Complete {n} perfect lesson", Metric.PERFECT_LESSONS, 1, 10, Icon.TARGET),
    QuestDef("combo_10", 2, "Earn {n} Combo Bonus XP", Metric.COMBO_XP, 10, 10, Icon.FLAME),
    QuestDef("streak5_2", 2, IN_A_ROW, Metric.STREAK5_LESSONS, 2, 10, Icon.FLAME),
    QuestDef("lessons_3", 3, "Complete {n} lessons", Metric.LESSONS, 3, 15, Icon.BOOK),
    QuestDef("perfect_3", 3, "Complete {n} perfect lessons", Metric.PERFECT_LESSONS, 3, 15, Icon.TARGET),
    QuestDef("combo_20", 3, "Earn {n} Combo Bonus XP", Metric.COMBO_XP, 20, 15, Icon.FLAME),
    QuestDef("streak5_4", 3, IN_A_ROW, Metric.STREAK5_LESSONS, 4, 15, Icon.FLAME),
)
DAY = date(2026, 10, 8)


def line(
    session_id: int, reason: XpReason, amount: int, *, mistakes: int = 0, best_combo: int = 6
) -> EarnedXp:
    """One XP line of `session_id`, carrying that session's mistakes and best combo."""
    return EarnedXp(session_id, reason, amount, mistakes=mistakes, best_combo=best_combo)


# One busy day: two lessons, a unit review, a practice and a timed run.
BUSY_DAY = [
    line(1, XpReason.LESSON, 10),
    line(1, XpReason.COMBO, 5),
    line(2, XpReason.REVIEW, 40, mistakes=1, best_combo=5),
    line(2, XpReason.COMBO, 4, mistakes=1, best_combo=5),
    line(3, XpReason.PRACTICE, 10, best_combo=10),
    line(3, XpReason.COMBO, 5, best_combo=10),
    line(4, XpReason.LESSON, 10, mistakes=2, best_combo=3),
    line(4, XpReason.COMBO, 3, mistakes=2, best_combo=3),
    line(4, XpReason.BOOST, 13, mistakes=2, best_combo=3),
    line(5, XpReason.TIMED, 12, mistakes=3, best_combo=4),
]


class TestTodaysQuests:
    def test_slot_one_is_always_the_daily_goal_then_one_quest_per_slot(self) -> None:
        for offset in range(30):
            quests = todays_quests(1, DAY + timedelta(days=offset), CATALOGUE)
            assert [q.slot for q in quests] == [1, 2, 3]
            assert quests[0] == DAILY_GOAL

    def test_the_pick_is_stable_for_a_learner_and_day(self) -> None:
        assert todays_quests(1, DAY, CATALOGUE) == todays_quests(1, DAY, CATALOGUE)
        assert todays_quests(1, DAY, CATALOGUE) == todays_quests(1, DAY, tuple(reversed(CATALOGUE)))

    def test_the_pick_changes_from_day_to_day(self) -> None:
        def codes(day: date) -> tuple[str, ...]:
            return tuple(quest.code for quest in todays_quests(1, day, CATALOGUE))

        assert len({codes(DAY + timedelta(days=n)) for n in range(30)}) > 1


class TestMetrics:
    def test_each_metric_is_computed_from_the_days_xp_lines(self) -> None:
        assert quest_metrics(BUSY_DAY) == {
            Metric.DAILY_GOAL_XP: 112,  # every line, boost included
            Metric.LESSONS: 3,  # sessions 1, 2 and 4; practice and timed are not lessons
            Metric.PERFECT_LESSONS: 1,  # session 1 only
            Metric.COMBO_XP: 17,  # 5 + 4 + 5 + 3
            Metric.STREAK5_LESSONS: 2,  # sessions 1 (6 in a row) and 2 (5 in a row)
        }

    def test_an_empty_day_counts_zero_everywhere(self) -> None:
        assert set(quest_metrics([]).values()) == {0}


class TestProgress:
    def test_the_daily_goal_quest_targets_the_learners_goal(self) -> None:
        progress = quest_progress(DAILY_GOAL, quest_metrics([line(1, XpReason.LESSON, 10)]), daily_goal_xp=20)
        assert progress == QuestProgress(DAILY_GOAL, "Earn 20 XP", progress=10, target=20)
        assert not progress.reached

    @pytest.mark.parametrize(
        ("code", "progress", "reached"),
        [("lessons_2", 2, True), ("perfect_3", 1, False)],
    )
    def test_progress_is_capped_at_the_target(self, code: str, progress: int, reached: bool) -> None:
        quest = next(q for q in CATALOGUE if q.code == code)
        result = quest_progress(quest, quest_metrics(BUSY_DAY), daily_goal_xp=20)
        assert (result.progress, result.reached) == (progress, reached)

    def test_titles_fill_in_the_target(self) -> None:
        quest = next(q for q in CATALOGUE if q.code == "streak5_4")
        title = quest_progress(quest, quest_metrics([]), daily_goal_xp=20).title
        assert title == "Get 5 in a row correct in 4 lessons"
