"""Achievements: newly reached levels, levels shown on the profile and their wording."""

from collections.abc import Sequence

import pytest

from app.domain.achievements import (
    AchievementDef,
    AchievementProgress,
    AchievementTierDef,
    Unlock,
    describe,
    highest_league,
    highest_per_achievement,
    level_of,
    newly_reached,
    progress_of,
)
from app.domain.enums import AchievementCode, AchievementMetric
from app.domain.rules import LEAGUE_TIERS

Metric = AchievementMetric


def tiers(first_id: int, thresholds: Sequence[int]) -> tuple[AchievementTierDef, ...]:
    return tuple(
        AchievementTierDef(id=first_id + level, level=level, threshold=threshold)
        for level, threshold in enumerate(thresholds, start=1)
    )


def champion_text(tier: int, league: str) -> str:
    return "Unlock Leaderboards by completing 10 lessons" if tier == 1 else f"Advance to the {league} League"


WILDFIRE = AchievementDef(
    AchievementCode.WILDFIRE, "Wildfire", Metric.LONGEST_STREAK, "Reach a {n} day streak", "#FF9600",
    tiers(100, (3, 7, 14, 30, 50, 75, 125, 180, 250, 365)),
)  # fmt: skip
SAGE = AchievementDef(
    AchievementCode.SAGE, "Sage", Metric.TOTAL_XP, "Earn {n} XP", "#1CB0F6",
    tiers(200, (100, 250, 500, 1000, 2000, 4000, 7500, 12500, 20000, 30000)),
)  # fmt: skip
SHARPSHOOTER = AchievementDef(
    AchievementCode.SHARPSHOOTER, "Sharpshooter", Metric.PERFECT_LESSONS,
    "Complete {n} lessons with no mistakes", "#FF4B4B", tiers(300, (1, 5, 20, 50, 100)),
)  # fmt: skip
CHAMPION = AchievementDef(
    AchievementCode.CHAMPION, "Champion", Metric.HIGHEST_LEAGUE, "Reach league {n}", "#58CC02",
    tuple(
        AchievementTierDef(
            400 + t.tier, level=t.tier, threshold=t.tier, description=champion_text(t.tier, t.name)
        )
        for t in LEAGUE_TIERS
    ),
)  # fmt: skip
CATALOGUE = (WILDFIRE, SAGE, SHARPSHOOTER, CHAMPION)


def metrics(streak: int = 0, xp: int = 0, perfect: int = 0, league: int = 0) -> dict[AchievementMetric, int]:
    return {
        Metric.LONGEST_STREAK: streak,
        Metric.TOTAL_XP: xp,
        Metric.PERFECT_LESSONS: perfect,
        Metric.HIGHEST_LEAGUE: league,
    }


def levels(unlocks: list[Unlock]) -> list[tuple[AchievementCode, int]]:
    return [(u.achievement.code, u.tier.level) for u in unlocks]


class TestNewlyReached:
    def test_several_levels_can_be_reached_at_once(self) -> None:
        unlocks = newly_reached(CATALOGUE, metrics(streak=14), owned_tier_ids=set())
        assert levels(unlocks) == [("wildfire", 1), ("wildfire", 2), ("wildfire", 3)]

    def test_owned_levels_are_not_reported_again(self) -> None:
        owned = {101, 102, 201, 202, 301, 302, 401, 402}  # the seeded learner's badges
        unlocks = newly_reached(CATALOGUE, metrics(streak=14, xp=388, perfect=5, league=2), owned)
        assert levels(unlocks) == [("wildfire", 3)]

    def test_nothing_new_when_no_threshold_is_crossed(self) -> None:
        assert newly_reached(CATALOGUE, metrics(streak=2, xp=99), owned_tier_ids=set()) == []

    def test_the_receipt_keeps_the_highest_new_level_per_achievement_in_catalogue_order(self) -> None:
        unlocks = newly_reached(CATALOGUE, metrics(streak=7, xp=260, league=1), owned_tier_ids={101})
        assert levels(highest_per_achievement(unlocks)) == [("wildfire", 2), ("sage", 2), ("champion", 1)]


class TestLevels:
    @pytest.mark.parametrize(
        ("value", "level"),
        [(0, 0), (2, 0), (3, 1), (13, 2), (14, 3), (365, 10), (5000, 10)],
    )
    def test_level_of_counts_the_thresholds_reached(self, value: int, level: int) -> None:
        assert level_of(WILDFIRE, value) == level

    def test_the_profile_describes_the_next_level(self) -> None:
        assert progress_of(WILDFIRE, 13) == AchievementProgress(
            level=2, max_level=10, next_threshold=14, description="Reach a 14 day streak"
        )

    def test_a_maxed_achievement_describes_its_last_level(self) -> None:
        assert progress_of(SHARPSHOOTER, 250) == AchievementProgress(
            level=5, max_level=5, next_threshold=None, description="Complete 100 lessons with no mistakes"
        )

    def test_a_fresh_learner_sees_level_one_as_the_goal(self) -> None:
        assert progress_of(SAGE, 0) == AchievementProgress(
            level=0, max_level=10, next_threshold=100, description="Earn 100 XP"
        )


class TestDescriptions:
    def test_the_template_fills_in_the_threshold(self) -> None:
        assert describe(SAGE, SAGE.tiers[3]) == "Earn 1000 XP"

    @pytest.mark.parametrize(
        ("level", "text"),
        [
            (1, "Unlock Leaderboards by completing 10 lessons"),
            (2, "Advance to the Silver League"),
            (10, "Advance to the Diamond League"),
        ],
    )
    def test_champion_levels_have_their_own_wording(self, level: int, text: str) -> None:
        assert describe(CHAMPION, CHAMPION.tiers[level - 1]) == text


class TestHighestLeague:
    def test_zero_while_leagues_are_locked(self) -> None:
        assert highest_league(1, [], leagues_open=False) == 0

    def test_the_current_tier_once_unlocked(self) -> None:
        assert highest_league(1, [], leagues_open=True) == 1
        assert highest_league(2, [1], leagues_open=True) == 2

    def test_a_demotion_never_lowers_it(self) -> None:
        assert highest_league(2, [2, 3, 2], leagues_open=True) == 3
