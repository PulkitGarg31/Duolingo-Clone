"""GET /me (the shell's whole state) and GET /me/activity (the per-day history)."""

from datetime import date, datetime

from pydantic import Field

from app.domain.enums import DayState, LeagueZone, SessionKind, StreakStatus
from app.schemas.base import ApiModel
from app.schemas.common import CourseBrief, DailyGoalXp, HeartsOut, LeagueBrief
from app.schemas.league import LeagueResultOut
from app.schemas.settings import SettingsOut


class MeUser(ApiModel):
    """The signed-in learner."""

    id: int
    username: str
    display_name: str
    avatar_color: str
    timezone: str
    timezone_confirmed: bool  # the browser's time zone has been adopted once
    joined_at: datetime


class MeXp(ApiModel):
    """XP totals: all time, the learner's local today, and the current league week."""

    total: int
    today: int
    this_week: int


class MeStreak(ApiModel):
    """The streak and its freezes, as the streak stat and its popover show them."""

    current: int
    longest: int
    status: StreakStatus
    extended_today: bool
    frozen_yesterday: bool  # yesterday was covered by a Streak Freeze
    freezes_equipped: int
    max_freezes: int
    next_milestone: int


class DailyGoalOut(ApiModel):
    """Progress towards today's XP goal."""

    goal_xp: DailyGoalXp
    earned_xp: int
    met: bool


class MeLeague(LeagueBrief):
    """The learner's league this week. Rank, zone and XP to pass are null until they join a cohort."""

    unlocked: bool
    lessons_to_unlock: int
    joined_this_week: bool
    rank: int | None
    weekly_xp: int
    zone: LeagueZone | None
    xp_to_pass_next: int | None  # XP needed to pass the row above; null at rank 1
    cohort_size: int
    promote_count: int
    demote_count: int
    week_ends_at: datetime


class XpBoostOut(ApiModel):
    """The Double XP power-up."""

    active: bool
    ends_at: datetime | None
    multiplier: int


class ActiveSessionRef(ApiModel):
    """The session the learner left unfinished, if any."""

    id: int
    kind: SessionKind
    node_id: int | None


class DevInfo(ApiModel):
    """Demo tools state; the whole object is null when the tools are turned off."""

    enabled: bool
    clock_offset_seconds: int


class MeOut(ApiModel):
    """Everything the app shell needs: top bar stats, league card, daily goal and pending modals."""

    user: MeUser
    course: CourseBrief
    server_now: datetime
    local_date: date
    xp: MeXp
    gems: int
    hearts: HeartsOut
    streak: MeStreak
    daily_goal: DailyGoalOut
    league: MeLeague
    xp_boost: XpBoostOut
    active_session: ActiveSessionRef | None
    pending_league_result: LeagueResultOut | None
    settings: SettingsOut
    dev: DevInfo | None


class ActivityDayOut(ApiModel):
    """One local day of history. `goalXp` is the goal in force that day, null when nothing was earned."""

    date: date
    xp: int
    goal_xp: DailyGoalXp | None
    goal_met: bool
    state: DayState


class ActivityOut(ApiModel):
    """One item per local day from `from` to `to` inclusive, oldest first."""

    from_: date = Field(alias="from")
    to: date
    today: date
    items: list[ActivityDayOut]
