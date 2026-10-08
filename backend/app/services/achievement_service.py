"""Achievements: measure a user's statistics, record newly reached levels and build the profile rows.

A level is always recomputed from the live statistic, which only ever grows. `user_achievements`
records just the moment a learner first reached each level: it drives the unlock celebration and
the dates on the profile. Bots never get rows; their levels are computed from their baselines and
their league weeks, for display only.
"""

from collections.abc import Mapping
from datetime import datetime

from sqlalchemy.orm import Session

from app.core.errors import NotFound
from app.domain import achievements, bots, leagues
from app.domain.achievements import AchievementDef, AchievementTierDef, Unlock
from app.domain.enums import AchievementCode, AchievementMetric, TextLang
from app.models import Achievement, BotProfile, LeagueMembership, User, UserAchievement
from app.repositories import content_repo, gamification_repo, league_repo, ledger_repo, play_repo, user_repo
from app.schemas.completion import AchievementUnlockOut
from app.schemas.profile import AchievementOut, AchievementTierOut
from app.services import path_service

Metric = AchievementMetric


def metrics_for(db: Session, user_id: int, now: datetime) -> dict[AchievementMetric, int]:
    """Every achievement statistic of a learner or a bot, as of `now`."""
    profile = user_repo.get_bot_profile(db, user_id)
    if profile is not None:
        return _bot_metrics(db, profile, now)
    return _learner_metrics(db, user_id)


def evaluate(
    db: Session, user_id: int, now: datetime, session_id: int | None = None
) -> list[AchievementUnlockOut]:
    """Record every level the learner's statistics reach for the first time.

    Each new level gets a `user_achievements` row unlocked at `now`, linked to the completed session
    that reached it when there is one. The result holds the highest new level of each achievement,
    in catalogue order, because the unlock screen celebrates one level per badge. Bots earn no
    rows, so for a bot the result is always empty.
    """
    if user_repo.is_bot(db, user_id):
        return []
    catalogue = _catalogue(db)
    owned = gamification_repo.unlocked_tiers(db, user_id)
    unlocks = achievements.newly_reached(catalogue, _learner_metrics(db, user_id), owned)
    db.add_all(
        UserAchievement(
            user_id=user_id, achievement_tier_id=unlock.tier.id, session_id=session_id, unlocked_at=now
        )
        for unlock in unlocks
    )
    return [_unlock_out(unlock) for unlock in achievements.highest_per_achievement(unlocks)]


def list_for_profile(db: Session, user_id: int, now: datetime, *, is_bot: bool) -> list[AchievementOut]:
    """Every achievement in catalogue order, with the level its statistic reaches and the next goal.

    A learner's reached levels carry the date they were first reached; a bot's never do.
    """
    metrics = metrics_for(db, user_id, now)
    unlocked = {} if is_bot else gamification_repo.unlocked_tiers(db, user_id)
    return [
        _achievement_out(achievement, metrics[achievement.metric], unlocked) for achievement in _catalogue(db)
    ]


# ---- statistics ----


def _learner_metrics(db: Session, user_id: int) -> dict[AchievementMetric, int]:
    """A learner's statistics, all derived from their facts except the stored streak record and tier."""
    user = user_repo.get(db, user_id)
    stats = user_repo.get_stats(db, user_id)
    if user is None or stats is None:
        raise NotFound("There is no learner with that id.")
    highest_cohort = league_repo.highest_cohort_tier(db, user_id)
    leagues_open = leagues.leagues_unlocked(play_repo.count_completed_sessions(db, user_id))
    return {
        Metric.LONGEST_STREAK: stats.streak_longest,
        Metric.TOTAL_XP: ledger_repo.total_xp(db, user_id),
        Metric.WORDS_LEARNED: _words_learned(db, user),
        Metric.PERFECT_LESSONS: play_repo.count_perfect_lessons(db, user_id),
        Metric.HIGHEST_LEAGUE: achievements.highest_league(
            stats.league_tier, [] if highest_cohort is None else [highest_cohort], leagues_open=leagues_open
        ),
        Metric.FIRST_PLACE_FINISHES: league_repo.count_finishes(db, user_id, best_rank=1),
        Metric.DIAMOND_WINS: league_repo.count_finishes(db, user_id, best_rank=1, tier=leagues.HIGHEST_TIER),
    }


def _words_learned(db: Session, user: User) -> int:
    """Glossary terms in the course's language that the nodes the learner has finished introduce."""
    path_now = path_service.snapshot(db, user)
    language = TextLang(path_now.course.learning_language)
    return content_repo.count_glossary_terms(db, path_now.course.id, language, path_now.finished_node_ids())


def _bot_metrics(db: Session, profile: BotProfile, now: datetime) -> dict[AchievementMetric, int]:
    """A bot's statistics: its static baselines plus what its league weeks add, nothing else."""
    memberships = league_repo.memberships_with_cohorts(db, profile.user_id)
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


# ---- catalogue and responses ----


def _catalogue(db: Session) -> list[AchievementDef]:
    """The achievement catalogue in display order, as the domain rules see it."""
    return [_definition(row) for row in gamification_repo.achievements(db)]


def _definition(row: Achievement) -> AchievementDef:
    """One achievement row and its levels, as a domain definition."""
    return AchievementDef(
        code=AchievementCode(row.code),
        name=row.name,
        metric=row.metric,
        description_template=row.description_template,
        color=row.color,
        tiers=tuple(
            AchievementTierDef(tier.id, tier.level, tier.threshold, tier.description) for tier in row.tiers
        ),
    )


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
