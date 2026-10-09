"""Achievements: measure a user's statistics, record newly reached levels and build the profile rows.

A level is always recomputed from the live statistic, which only ever grows. `user_achievements`
records just the moment a learner first reached each level: it drives the unlock celebration and
the dates on the profile. Bots never get rows; their levels are computed from their baselines and
their league weeks, for display only. A bot competes in many learners' private cohorts, so its
league weeks are those of the learner looking at it, the same weeks that learner's board shows.
"""

from collections.abc import Mapping
from datetime import datetime

from sqlalchemy.orm import Session

from app.domain import achievements, bots, leagues
from app.domain.achievements import AchievementDef, Unlock
from app.domain.enums import AchievementMetric
from app.models import BotProfile, LeagueMembership, User, UserAchievement, UserStats
from app.repositories import gamification_repo, league_repo, ledger_repo, play_repo, user_repo
from app.schemas.completion import AchievementUnlockOut
from app.schemas.profile import AchievementOut, AchievementTierOut
from app.services import path_service, reference
from app.services.path_service import PathSnapshot

Metric = AchievementMetric


def metrics_for(
    db: Session,
    user: User,
    now: datetime,
    path_now: PathSnapshot | None = None,
    *,
    viewer_id: int | None = None,
) -> dict[AchievementMetric, int]:
    """Every achievement statistic of a learner or a bot, as of `now`.

    A learner's words learned come from their path: pass `path_now` when it is already at hand. A
    bot's league weeks are counted in the cohorts of the learner `viewer_id`, who must be given.
    """
    if user.bot_profile is not None:
        if viewer_id is None:
            raise ValueError("a bot's statistics depend on whose cohorts they are counted in")
        return _bot_metrics(db, user.bot_profile, now, viewer_id)
    stats = _stats(db, user.id)
    return _learner_metrics(db, user, stats, path_now or path_service.snapshot(db, user))


def evaluate(
    db: Session,
    user_id: int,
    now: datetime,
    session_id: int | None = None,
    *,
    path_now: PathSnapshot | None = None,
) -> list[AchievementUnlockOut]:
    """Record every level the learner's statistics reach for the first time.

    Each new level gets a `user_achievements` row unlocked at `now`, linked to the completed session
    that reached it when there is one. The result holds the highest new level of each achievement,
    in catalogue order, because the unlock screen celebrates one level per badge. Bots have no
    stats and earn no rows, so for a bot the result is always empty. Pass `path_now` when the
    learner's path is already at hand.
    """
    stats = user_repo.get_stats(db, user_id)
    if stats is None:  # a bot
        return []
    catalogue = reference.catalog(db).achievements
    owned = gamification_repo.unlocked_tiers(db, user_id)
    metrics = _learner_metrics(db, stats.user, stats, path_now or path_service.snapshot(db, stats.user))
    unlocks = achievements.newly_reached(catalogue, metrics, owned)
    db.add_all(
        UserAchievement(
            user_id=user_id, achievement_tier_id=unlock.tier.id, session_id=session_id, unlocked_at=now
        )
        for unlock in unlocks
    )
    return [_unlock_out(unlock) for unlock in achievements.highest_per_achievement(unlocks)]


def list_for_profile(
    db: Session, user_id: int, metrics: Mapping[AchievementMetric, int], *, is_bot: bool
) -> list[AchievementOut]:
    """Every achievement in catalogue order, with the level its statistic (from `metrics_for`) reaches
    and the next goal. A learner's reached levels carry the date they were first reached; a bot's
    never do."""
    unlocked = {} if is_bot else gamification_repo.unlocked_tiers(db, user_id)
    return [
        _achievement_out(achievement, metrics[achievement.metric], unlocked)
        for achievement in reference.catalog(db).achievements
    ]


# ---- statistics ----


def _learner_metrics(
    db: Session, user: User, stats: UserStats, path_now: PathSnapshot
) -> dict[AchievementMetric, int]:
    """A learner's statistics, all derived from their facts except the stored streak record and tier.

    Words learned are the glossary words of the course's language that the finished nodes introduce.
    """
    highest_cohort = league_repo.highest_cohort_tier(db, user.id)
    leagues_open = leagues.leagues_unlocked(play_repo.count_completed_sessions(db, user.id))
    return {
        Metric.LONGEST_STREAK: stats.streak_longest,
        Metric.TOTAL_XP: ledger_repo.total_xp(db, user.id),
        Metric.WORDS_LEARNED: path_now.content.words_introduced(path_now.finished_node_ids()),
        Metric.PERFECT_LESSONS: play_repo.count_perfect_lessons(db, user.id),
        Metric.HIGHEST_LEAGUE: achievements.highest_league(
            stats.league_tier, [] if highest_cohort is None else [highest_cohort], leagues_open=leagues_open
        ),
        Metric.FIRST_PLACE_FINISHES: league_repo.count_finishes(db, user.id, owner_id=user.id, best_rank=1),
        Metric.DIAMOND_WINS: league_repo.count_finishes(
            db, user.id, owner_id=user.id, best_rank=1, tier=leagues.HIGHEST_TIER
        ),
    }


def _stats(db: Session, user_id: int) -> UserStats:
    stats = user_repo.get_stats(db, user_id)
    if stats is None:  # every learner has a stats row; bots are measured separately
        raise RuntimeError(f"learner {user_id} has no stats row")
    return stats


def _bot_metrics(
    db: Session, profile: BotProfile, now: datetime, viewer_id: int
) -> dict[AchievementMetric, int]:
    """A bot's statistics: its static baselines plus what its weeks in the viewer's cohorts add."""
    memberships = league_repo.memberships_with_cohorts(db, profile.user_id, viewer_id)
    first_places = [m for m in memberships if m.final_rank == 1]
    return {
        Metric.LONGEST_STREAK: profile.baseline_streak,
        Metric.TOTAL_XP: profile.baseline_xp + sum(_bot_week_xp(profile, m, now) for m in memberships),
        Metric.WORDS_LEARNED: 0,
        Metric.PERFECT_LESSONS: 0,
        Metric.HIGHEST_LEAGUE: max((m.cohort.league_tier for m in memberships), default=0),
        Metric.FIRST_PLACE_FINISHES: len(first_places),
        Metric.DIAMOND_WINS: sum(1 for m in first_places if m.cohort.league_tier == leagues.HIGHEST_TIER),
    }


def _bot_week_xp(profile: BotProfile, membership: LeagueMembership, now: datetime) -> int:
    """A finished week's recorded XP, or what the bot has earned so far in a running week.

    This is the same number the leaderboard shows, so a bot's profile always agrees with the board.
    """
    if membership.final_xp is not None:
        return membership.final_xp
    cohort = membership.cohort
    xp, _ = bots.bot_week_xp(profile.rng_seed, profile.daily_xp, cohort.week_start, cohort.league_tier, now)
    return xp


# ---- responses ----


def _unlock_out(unlock: Unlock) -> AchievementUnlockOut:
    """A newly reached level, as the completion receipt shows it."""
    achievement, tier = unlock.achievement, unlock.tier
    return AchievementUnlockOut(
        code=achievement.code,
        name=achievement.name,
        level=tier.level,
        threshold=tier.threshold,
        description=achievements.describe(achievement, tier),
        color=achievement.color,
    )


def _achievement_out(
    achievement: AchievementDef, value: int, unlocked: Mapping[int, datetime]
) -> AchievementOut:
    """An achievement's profile row for a statistic `value`."""
    progress = achievements.progress_of(achievement, value)
    return AchievementOut(
        code=achievement.code,
        name=achievement.name,
        color=achievement.color,
        level=progress.level,
        max_level=progress.max_level,
        current_value=value,
        next_threshold=progress.next_threshold,
        description=progress.description,
        tiers=[
            AchievementTierOut(level=tier.level, threshold=tier.threshold, unlocked_at=unlocked.get(tier.id))
            for tier in achievement.tiers
        ],
    )
