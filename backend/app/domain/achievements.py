"""Achievements: leveled badges, each measured against one learner statistic.

A level is reached once its statistic meets the level's threshold. Every statistic only grows
(the longest streak, total XP, words learned, perfect lessons, the highest league, first places),
so a level once reached is never lost. The catalogue (names, thresholds, wording) is seed data;
these rules only compare numbers with it.
"""

from collections.abc import Collection, Iterable, Mapping
from dataclasses import dataclass

from app.domain.enums import AchievementCode, AchievementMetric


@dataclass(frozen=True)
class AchievementTierDef:
    """One level of an achievement ("LEVEL 3") and the statistic value that reaches it."""

    id: int
    level: int
    threshold: int
    description: str | None = None  # wording for this level alone (Champion); else the template


@dataclass(frozen=True)
class AchievementDef:
    """A catalogue achievement with its levels, ordered by level (thresholds strictly increase)."""

    code: AchievementCode
    name: str
    metric: AchievementMetric
    description_template: str  # 'Reach a {n} day streak'
    color: str
    tiers: tuple[AchievementTierDef, ...]


@dataclass(frozen=True)
class Unlock:
    """A level the learner has just reached."""

    achievement: AchievementDef
    tier: AchievementTierDef


@dataclass(frozen=True)
class AchievementProgress:
    """An achievement's row on the profile."""

    level: int
    max_level: int
    next_threshold: int | None  # None once every level is reached
    description: str  # the next level's goal, or the last level's once maxed


def newly_reached(
    catalogue: Iterable[AchievementDef],
    metrics: Mapping[AchievementMetric, int],
    owned_tier_ids: Collection[int],
) -> list[Unlock]:
    """Every level the learner's statistics reach that they don't own yet, in catalogue order.

    One session can cross several levels at once (a long streak, a big XP jump); each is returned.
    `metrics` must hold a value for every metric of the catalogue.
    """
    return [
        Unlock(achievement, tier)
        for achievement in catalogue
        for tier in achievement.tiers
        if tier.id not in owned_tier_ids and metrics[achievement.metric] >= tier.threshold
    ]


def highest_per_achievement(unlocks: Iterable[Unlock]) -> list[Unlock]:
    """The highest new level of each achievement, in the order the achievements first appear.

    The completion screen celebrates one level per achievement, not every level crossed.
    """
    best: dict[AchievementCode, Unlock] = {}
    for unlock in unlocks:
        kept = best.get(unlock.achievement.code)
        if kept is None or unlock.tier.level > kept.tier.level:
            best[unlock.achievement.code] = unlock
    return list(best.values())


def level_of(achievement: AchievementDef, value: int) -> int:
    """The level shown on the profile: how many thresholds the statistic has reached."""
    return sum(1 for tier in achievement.tiers if tier.threshold <= value)


def describe(achievement: AchievementDef, tier: AchievementTierDef) -> str:
    """The wording of one level: its own text when it has one, else the template with its threshold."""
    if tier.description is not None:
        return tier.description
    return achievement.description_template.format(n=tier.threshold)


def progress_of(achievement: AchievementDef, value: int) -> AchievementProgress:
    """The profile row for a statistic `value`: the level reached and the goal of the next one."""
    upcoming = next((tier for tier in achievement.tiers if tier.threshold > value), None)
    shown = upcoming if upcoming is not None else achievement.tiers[-1]
    return AchievementProgress(
        level=level_of(achievement, value),
        max_level=len(achievement.tiers),
        next_threshold=upcoming.threshold if upcoming is not None else None,
        description=describe(achievement, shown),
    )


def highest_league(league_tier: int, cohort_tiers: Iterable[int], *, leagues_open: bool) -> int:
    """The Champion statistic: 0 while leagues are locked, otherwise the highest tier ever reached.

    A demotion lowers the current tier but not the tiers of cohorts already played, so the
    statistic never drops.
    """
    if not leagues_open:
        return 0
    return max([league_tier, *cohort_tiers])
