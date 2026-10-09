"""GET /me: everything the app shell shows, built fresh from the learner's facts at `now`.

It is never stored or cached: the completion response attaches a newly built one after its commit.
"""

from sqlalchemy.orm import Session

from app.core.config import Settings
from app.domain import streak, xp
from app.domain.calendar import league_week_bounds, league_week_start
from app.domain.enums import StreakStatus
from app.domain.rules import MAX_STREAK_FREEZES, XP_BOOST_MULTIPLIER
from app.models import User
from app.repositories import ledger_repo, play_repo
from app.schemas.me import (
    ActiveSessionRef,
    DailyGoalOut,
    DevInfo,
    MeOut,
    MeStreak,
    MeUser,
    MeXp,
    XpBoostOut,
)
from app.services import hearts_service, league_service, path_service, settings_service, streak_service
from app.services.context import RequestContext, is_demo_learner
from app.services.league_service import LeagueWeek


def build_me(db: Session, ctx: RequestContext, league_week: LeagueWeek | None = None) -> MeOut:
    """The learner's whole shell state: top bar stats, daily goal, league card and pending modals.

    A completion passes the league week it has just read, so the cohort is not ranked twice.
    """
    user, stats = ctx.user, ctx.stats
    week_start, week_end = league_week_bounds(league_week_start(ctx.now))
    earned = ledger_repo.xp_totals(db, user.id, ctx.today, week_start, week_end)
    goal = ctx.preferences.daily_goal_xp
    active = play_repo.active_session(db, user.id)
    return MeOut(
        user=me_user(user, ctx.settings),
        course=path_service.course_brief(path_service.course_of(db, user)),
        server_now=ctx.now,
        local_date=ctx.today,
        xp=MeXp(total=earned.total, today=earned.on_day, this_week=earned.in_window),
        gems=stats.gems,
        hearts=hearts_service.hearts_out(db, stats, ctx.settings),
        streak=_streak(db, ctx),
        daily_goal=DailyGoalOut(goal_xp=goal, earned_xp=earned.on_day, met=earned.on_day >= goal),
        league=league_service.me_league(db, ctx, league_week),
        xp_boost=_xp_boost(ctx),
        active_session=None
        if active is None
        else ActiveSessionRef(id=active.id, kind=active.kind, node_id=active.node_id),
        pending_league_result=league_service.pending_result(db, user.id),
        settings=settings_service.settings_out(user, ctx.preferences),
        dev=DevInfo(enabled=True, clock_offset_seconds=user.clock_offset_seconds)
        if ctx.settings.enable_dev_tools
        else None,
    )


def me_user(user: User, settings: Settings) -> MeUser:
    """Who the learner is: their name, zone and email, and whether they play the demo (a guest or the
    shared demo learner) rather than an account."""
    return MeUser(
        id=user.id,
        username=user.username,
        display_name=user.display_name,
        avatar_color=user.avatar_color,
        timezone=user.timezone,
        timezone_confirmed=user.timezone_confirmed,
        joined_at=user.joined_at,
        email=user.email,
        is_demo=is_demo_learner(user, settings),
    )


def _streak(db: Session, ctx: RequestContext) -> MeStreak:
    """The streak flame: at risk (grey) until a session today extends it (orange)."""
    stats = ctx.stats
    status = streak.status(streak_service.state_of(stats), ctx.today)
    return MeStreak(
        current=stats.streak_current,
        longest=stats.streak_longest,
        status=status,
        extended_today=status == StreakStatus.EXTENDED,
        frozen_yesterday=streak_service.frozen_yesterday(db, ctx.user.id, ctx.today),
        freezes_equipped=stats.streak_freezes,
        max_freezes=MAX_STREAK_FREEZES,
        next_milestone=streak_service.next_milestone(stats.streak_current),
    )


def _xp_boost(ctx: RequestContext) -> XpBoostOut:
    """The Double XP power-up; its end time is shown only while it runs."""
    active = xp.is_boost_active(ctx.stats.xp_boost_until, ctx.now)
    return XpBoostOut(
        active=active,
        ends_at=ctx.stats.xp_boost_until if active else None,
        multiplier=XP_BOOST_MULTIPLIER,
    )
