"""Leagues: joining this week's cohort, live standings, weekly finalization and the league views.

A league week is one global window (Monday 00:00 UTC). Once leagues are unlocked, a learner joins
the cohort of their tier with the week's first XP. Bots fill the cohort and earn XP from a pure
schedule, so the board moves with time and writes nothing. Ended weeks are finalized lazily by the
sync, oldest first, which is also when learners move up or down a tier.
"""

from dataclasses import dataclass
from datetime import date, datetime

from sqlalchemy.orm import Session

from app.core.errors import LeagueResultNotReady, NotFound
from app.domain import leagues
from app.domain.bots import bot_week_xp
from app.domain.calendar import league_week_bounds, league_week_start
from app.domain.leagues import Ranked, Standing
from app.domain.rules import LEAGUE_COHORT_SIZE
from app.models import BotProfile, League, LeagueCohort, LeagueMembership, User
from app.repositories import league_repo, play_repo, user_repo
from app.schemas.common import LeagueBrief
from app.schemas.league import LeagueAckOut, LeagueOut, LeagueResultOut, LeagueRowOut, LeagueTierOut
from app.schemas.me import MeLeague
from app.services import achievement_service
from app.services.context import RequestContext


@dataclass(frozen=True)
class LeagueJoin:
    """The learner's membership this week, and whether the current session created it."""

    joined_now: bool
    membership: LeagueMembership


@dataclass(frozen=True)
class CohortStanding:
    """The learner's cohort this week ranked as of now, and the learner's own row in it."""

    cohort: LeagueCohort
    ranked: list[Ranked]
    mine: Ranked


# ---- joining and ranking ----


def ensure_membership(db: Session, ctx: RequestContext) -> LeagueJoin | None:
    """Join this week's cohort of the learner's tier on the week's first XP.

    Returns None while leagues are locked (fewer than 10 completed sessions). The first learner of
    a (tier, week) opens its cohort, which also draws the bots.
    """
    if not leagues.leagues_unlocked(play_repo.count_completed_sessions(db, ctx.user.id)):
        return None
    week = league_week_start(ctx.now)
    existing = league_repo.membership_for_week(db, ctx.user.id, week)
    if existing is not None:
        return LeagueJoin(joined_now=False, membership=existing)
    tier = ctx.stats.league_tier
    cohort = league_repo.get_cohort(db, tier, week) or _open_cohort(db, tier, week, ctx.now)
    membership = LeagueMembership(cohort_id=cohort.id, user_id=ctx.user.id, joined_at=ctx.now)
    db.add(membership)
    return LeagueJoin(joined_now=True, membership=membership)


def standings(db: Session, cohort: LeagueCohort, until: datetime) -> list[Ranked]:
    """The cohort ranked by XP: learners from the shared XP ledger, bots from their schedules up to
    `until`. Ties go to whoever reached their XP first."""
    start, end = league_week_bounds(cohort.week_start)
    rows = [
        Standing(r.user_id, r.xp, r.reached_at)
        for r in league_repo.human_weekly_xp(db, cohort.id, start, end)
    ]
    rows += [_bot_standing(bot, cohort, until) for bot in league_repo.bot_members(db, cohort.id)]
    return leagues.rank(rows)


def current_standing(db: Session, user_id: int, now: datetime) -> CohortStanding | None:
    """The learner's cohort this week ranked as of `now`, or None before they joined this week."""
    membership = league_repo.membership_for_week(db, user_id, league_week_start(now))
    if membership is None:
        return None
    ranked = standings(db, membership.cohort, until=now)
    mine = next(row for row in ranked if row.user_id == user_id)
    return CohortStanding(membership.cohort, ranked, mine)


# ---- finalizing ended weeks ----


def finalize_due(db: Session, now: datetime) -> list[LeagueMembership]:
    """Finalize every cohort whose week has ended, oldest week first (the sync's first step).

    Every member, bots included, gets a final XP, rank and outcome; learners move to the tier their
    outcome gives and have their league achievements re-evaluated. A learner who earned nothing that
    week has no membership, so a skipped week never demotes. Returns the learners' results.
    """
    results: list[LeagueMembership] = []
    for cohort in league_repo.open_cohorts_before(db, league_week_start(now)):
        results += _finalize(db, cohort, now)
    for user_id in {membership.user_id for membership in results}:
        achievement_service.evaluate(db, user_id, now, session_id=None)
    return results


def _finalize(db: Session, cohort: LeagueCohort, now: datetime) -> list[LeagueMembership]:
    """Write the final standings of one ended week; returns the learners' memberships."""
    _, week_end = league_week_bounds(cohort.week_start)
    ranked = standings(db, cohort, until=week_end)
    memberships = {membership.user_id: membership for membership in cohort.memberships}
    learners: list[LeagueMembership] = []
    for row in ranked:
        membership = memberships[row.user_id]
        membership.final_xp, membership.final_rank = row.xp, row.rank
        membership.outcome = leagues.outcome(row.rank, len(ranked), row.xp, tier=cohort.league_tier)
        if not row.is_bot:
            _set_tier(db, row.user_id, leagues.tier_after(cohort.league_tier, membership.outcome), now)
            learners.append(membership)
    cohort.finalized_at = now
    return learners


# ---- views ----


def me_league(db: Session, ctx: RequestContext) -> MeLeague:
    """The shell's league card: unlock progress, the tier, and this week's rank and zone once joined."""
    completed = play_repo.count_completed_sessions(db, ctx.user.id)
    standing = current_standing(db, ctx.user.id, ctx.now)
    league = _league(db, standing.cohort.league_tier if standing else ctx.stats.league_tier)
    _, week_end = league_week_bounds(league_week_start(ctx.now))
    size = len(standing.ranked) if standing else LEAGUE_COHORT_SIZE
    return MeLeague(
        tier=league.tier,
        name=league.name,
        color=league.color,
        unlocked=leagues.leagues_unlocked(completed),
        lessons_to_unlock=leagues.sessions_to_unlock(completed),
        joined_this_week=standing is not None,
        rank=standing.mine.rank if standing else None,
        weekly_xp=standing.mine.xp if standing else 0,
        zone=leagues.zone(standing.mine.rank, size, tier=league.tier) if standing else None,
        xp_to_pass_next=leagues.xp_to_pass_next(standing.ranked, ctx.user.id) if standing else None,
        cohort_size=size,
        promote_count=league.promote_count,
        demote_count=league.demote_count,
        week_ends_at=week_end,
    )


def league_view(db: Session, ctx: RequestContext) -> LeagueOut:
    """The leaderboard page: the tier ladder, this week's standings once joined and last week's result."""
    completed = play_repo.count_completed_sessions(db, ctx.user.id)
    standing = current_standing(db, ctx.user.id, ctx.now)
    league = _league(db, standing.cohort.league_tier if standing else ctx.stats.league_tier)
    week = league_week_start(ctx.now)
    last = league_repo.latest_result(db, ctx.user.id)
    return LeagueOut(
        unlocked=leagues.leagues_unlocked(completed),
        lessons_to_unlock=leagues.sessions_to_unlock(completed),
        joined=standing is not None,
        league=_brief(league),
        tiers=_tiers(db, ctx.user.id, league.tier),
        week_start=week,
        week_ends_at=league_week_bounds(week)[1],
        server_now=ctx.now,
        promote_count=league.promote_count,
        demote_count=league.demote_count,
        cohort_size=len(standing.ranked) if standing else LEAGUE_COHORT_SIZE,
        rows=_rows(db, standing, ctx.user.id) if standing else [],
        last_week_result=result_out(db, last) if last else None,
    )


def pending_result(db: Session, user_id: int) -> LeagueResultOut | None:
    """The newest finished week whose result modal the learner has not acknowledged yet."""
    membership = league_repo.latest_result(db, user_id, unseen_only=True)
    return result_out(db, membership) if membership else None


def result_out(db: Session, membership: LeagueMembership) -> LeagueResultOut:
    """A finalized membership as the result modal shows it: the finish and the league it led to."""
    if membership.outcome is None or membership.final_rank is None or membership.final_xp is None:
        raise ValueError(f"membership {membership.id} is not finalized")
    tier = membership.cohort.league_tier
    return LeagueResultOut(
        membership_id=membership.id,
        week_start=membership.cohort.week_start,
        league=_brief(_league(db, tier)),
        final_rank=membership.final_rank,
        final_xp=membership.final_xp,
        outcome=membership.outcome,
        new_league=_brief(_league(db, leagues.tier_after(tier, membership.outcome))),
        seen=membership.result_seen_at is not None,
    )


def ack_result(db: Session, ctx: RequestContext, membership_id: int) -> LeagueAckOut:
    """Mark a finished week's result as seen. Repeating it keeps the first acknowledgement time."""
    membership = league_repo.get_membership(db, ctx.user.id, membership_id)
    if membership is None:
        raise NotFound("There is no league result with that id.")
    if membership.outcome is None:
        raise LeagueResultNotReady()
    if membership.result_seen_at is None:
        membership.result_seen_at = ctx.now
    return LeagueAckOut(membership_id=membership.id, seen_at=membership.result_seen_at)


def brief(db: Session, tier: int) -> LeagueBrief:
    """A tier's badge: number, name and colour."""
    return _brief(_league(db, tier))


# ---- helpers ----


def _open_cohort(db: Session, tier: int, week: date, now: datetime) -> LeagueCohort:
    """Create the (tier, week) cohort with its bots, drawn the same way in every process."""
    cohort = LeagueCohort(league_tier=tier, week_start=week, created_at=now)
    db.add(cohort)
    db.flush()  # the bots' memberships need the cohort's id
    week_start, _ = league_week_bounds(week)
    db.add_all(
        LeagueMembership(cohort_id=cohort.id, user_id=bot_id, joined_at=week_start)
        for bot_id in leagues.draw_bots(user_repo.bot_ids(db), tier, week)
    )
    return cohort


def _bot_standing(bot: BotProfile, cohort: LeagueCohort, until: datetime) -> Standing:
    xp, reached_at = bot_week_xp(bot.rng_seed, bot.daily_xp, cohort.week_start, cohort.league_tier, until)
    return Standing(bot.user_id, xp, reached_at, is_bot=True)


def _set_tier(db: Session, user_id: int, tier: int, now: datetime) -> None:
    stats = user_repo.get_stats(db, user_id)
    if stats is None:  # only learners are moved between tiers, and every learner has stats
        raise RuntimeError(f"learner {user_id} has no stats row")
    stats.league_tier, stats.updated_at = tier, now


def _tiers(db: Session, user_id: int, current_tier: int) -> list[LeagueTierOut]:
    """All ten tiers; those up to the highest ever reached are marked as reached."""
    highest = max(current_tier, league_repo.highest_cohort_tier(db, user_id) or 0)
    return [
        LeagueTierOut(tier=row.tier, name=row.name, color=row.color, reached=row.tier <= highest)
        for row in league_repo.leagues(db)
    ]


def _rows(db: Session, standing: CohortStanding, me_id: int) -> list[LeagueRowOut]:
    """Every member's leaderboard row, in rank order."""
    users = {user.id: user for user in league_repo.cohort_users(db, standing.cohort.id)}
    size = len(standing.ranked)
    return [
        LeagueRowOut(
            rank=row.rank,
            user_id=row.user_id,
            display_name=users[row.user_id].display_name,
            avatar_color=users[row.user_id].avatar_color,
            xp=row.xp,
            streak=_streak_of(users[row.user_id]),
            is_me=row.user_id == me_id,
            zone=leagues.zone(row.rank, size, tier=standing.cohort.league_tier),
        )
        for row in standing.ranked
    ]


def _streak_of(user: User) -> int:
    """A learner's current streak, or a bot's fixed baseline streak."""
    if user.bot_profile is not None:
        return user.bot_profile.baseline_streak
    return user.stats.streak_current if user.stats is not None else 0


def _league(db: Session, tier: int) -> League:
    league = league_repo.get_league(db, tier)
    if league is None:  # the ten tiers are seeded reference data
        raise RuntimeError(f"league tier {tier} is missing")
    return league


def _brief(league: League) -> LeagueBrief:
    return LeagueBrief(tier=league.tier, name=league.name, color=league.color)
