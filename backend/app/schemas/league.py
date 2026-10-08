"""GET /me/league and the league result: this week's cohort standings and last week's outcome."""

from datetime import date, datetime

from app.domain.enums import LeagueOutcome, LeagueZone
from app.schemas.base import ApiModel
from app.schemas.common import LeagueBrief


class LeagueResultOut(ApiModel):
    """A finished league week: where the learner finished and the league they moved to."""

    membership_id: int
    week_start: date
    league: LeagueBrief
    final_rank: int
    final_xp: int
    outcome: LeagueOutcome
    new_league: LeagueBrief
    seen: bool  # the result modal was acknowledged


class LeagueTierOut(LeagueBrief):
    """One of the ten tiers, for the badge carousel."""

    reached: bool


class LeagueRowOut(ApiModel):
    """One leaderboard row. `streak` is a bot's fixed baseline streak."""

    rank: int
    user_id: int
    display_name: str
    avatar_color: str
    xp: int
    streak: int
    is_me: bool
    zone: LeagueZone


class LeagueOut(ApiModel):
    """The leaderboard page. `rows` is empty until the learner has joined this week's cohort."""

    unlocked: bool
    lessons_to_unlock: int
    joined: bool
    league: LeagueBrief
    tiers: list[LeagueTierOut]
    week_start: date
    week_ends_at: datetime
    server_now: datetime
    promote_count: int
    demote_count: int
    cohort_size: int
    rows: list[LeagueRowOut]
    last_week_result: LeagueResultOut | None


class LeagueAckOut(ApiModel):
    """The league result modal was seen; the first acknowledgement time is kept."""

    membership_id: int
    seen_at: datetime
