"""Profiles (learners and league bots alike) and the learner's day-by-day activity history."""

from datetime import date, datetime, timedelta
from typing import Final, Literal

from sqlalchemy.orm import Session

from app.core.errors import NotFound, ValidationFailed
from app.domain import leagues, path
from app.domain.enums import AchievementMetric, ActivityKind, DayState
from app.models import BotProfile, User
from app.repositories import league_repo, ledger_repo, play_repo, user_repo
from app.schemas.me import ActivityDayOut, ActivityOut
from app.schemas.profile import ProfileOut, ProfileStats, ProfileUser
from app.services import achievement_service, league_service, path_service
from app.services.context import RequestContext

TOP_FINISH: Final = 3  # "top three finishes" on the profile
DEFAULT_ACTIVITY_DAYS: Final = 35  # five weeks: the streak calendar's default range
MAX_ACTIVITY_DAYS: Final = 92  # about a quarter


def profile(db: Session, ctx: RequestContext, user_ref: int | Literal["me"]) -> ProfileOut:
    """A learner's or a bot's profile: stats and every achievement in catalogue order.

    Bots have no lesson history, so their words, lessons and crowns are null; their totals come
    from the same numbers as the leaderboard, so the two always agree.
    """
    user = ctx.user if user_ref == "me" else user_repo.get(db, user_ref)
    if user is None:
        raise NotFound("There is no user with that id.")
    bot = user.bot_profile
    stats = _learner_stats(db, user, ctx.now) if bot is None else _bot_stats(db, bot, ctx.now)
    return ProfileOut(
        user=ProfileUser(
            id=user.id,
            username=user.username,
            display_name=user.display_name,
            avatar_color=user.avatar_color,
            joined_at=user.joined_at,
            is_me=user.id == ctx.user.id,
            is_bot=bot is not None,
        ),
        stats=stats,
        achievements=achievement_service.list_for_profile(db, user.id, ctx.now, is_bot=bot is not None),
    )


def activity(db: Session, ctx: RequestContext, first: date | None, last: date | None) -> ActivityOut:
    """One entry per local day from `first` to `last`: XP, the goal in force, and how the day counted.

    `last` defaults to today and `first` to five weeks before it. The range must end by today and
    cover at most 92 days.
    """
    last = ctx.today if last is None else last
    first = last - timedelta(days=DEFAULT_ACTIVITY_DAYS - 1) if first is None else first
    if not first <= last <= ctx.today:
        raise ValidationFailed("The range must run from 'from' to 'to', ending no later than today.")
    if (last - first).days + 1 > MAX_ACTIVITY_DAYS:
        raise ValidationFailed(f"The range can cover at most {MAX_ACTIVITY_DAYS} days.")
    xp_by_day = ledger_repo.xp_by_day(db, ctx.user.id, first, last)
    covered = {row.local_date: row for row in ledger_repo.activity_days_between(db, ctx.user.id, first, last)}
    items = []
    for offset in range((last - first).days + 1):
        day = first + timedelta(days=offset)
        row = covered.get(day)
        goal = row.goal_xp if row is not None and row.kind == ActivityKind.ACTIVE else None
        xp = xp_by_day.get(day, 0)
        items.append(
            ActivityDayOut(
                date=day,
                xp=xp,
                goal_xp=goal,
                goal_met=goal is not None and xp >= goal,
                state=DayState.NONE if row is None else DayState(row.kind.value),
            )
        )
    return ActivityOut(from_=first, to=last, today=ctx.today, items=items)


def _learner_stats(db: Session, user: User, now: datetime) -> ProfileStats:
    """A learner's stats, all derived from their facts. The ones achievements also use (longest
    streak, total XP, words learned) are measured exactly as for the achievements."""
    stats = user.stats
    if stats is None:  # every learner has a stats row; bots are handled separately
        raise RuntimeError(f"learner {user.id} has no stats row")
    metrics = achievement_service.metrics_for(db, user.id, now)
    path_now = path_service.snapshot(db, user)
    leagues_open = leagues.leagues_unlocked(play_repo.count_completed_sessions(db, user.id))
    return ProfileStats(
        current_streak=stats.streak_current,
        longest_streak=metrics[AchievementMetric.LONGEST_STREAK],
        total_xp=metrics[AchievementMetric.TOTAL_XP],
        league=league_service.brief(db, stats.league_tier) if leagues_open else None,
        top_three_finishes=league_repo.count_finishes(db, user.id, best_rank=TOP_FINISH),
        words_learned=metrics[AchievementMetric.WORDS_LEARNED],
        lessons_completed=play_repo.count_completed_lessons(db, user.id),
        crowns=sum(
            path.crown_level(node.kind, path_now.states[node.id])
            for unit in path_now.units
            for node in unit.nodes
        ),
    )


def _bot_stats(db: Session, bot: BotProfile, now: datetime) -> ProfileStats:
    """A bot's stats: its fixed streak, its newest league, and its baseline plus league XP, which is
    measured exactly as for its achievements (and from the same numbers as the leaderboard)."""
    tier = league_repo.latest_cohort_tier(db, bot.user_id)
    total_xp = achievement_service.metrics_for(db, bot.user_id, now)[AchievementMetric.TOTAL_XP]
    return ProfileStats(
        current_streak=bot.baseline_streak,
        longest_streak=bot.baseline_streak,
        total_xp=total_xp,
        league=None if tier is None else league_service.brief(db, tier),
        top_three_finishes=league_repo.count_finishes(db, bot.user_id, best_rank=TOP_FINISH),
        words_learned=None,
        lessons_completed=None,
        crowns=None,
    )
