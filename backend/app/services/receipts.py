"""The completion receipt: the learner's state captured before and after the rewards, compared.

`capture_before` and `capture_after` read the two states; `build` compares them with what the
rewards paid and writes the receipt behind the celebration screens. The receipt never contains `me`,
because it is cached for replays while `me` must always be fresh.
"""

from dataclasses import dataclass
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app.domain import session_flow
from app.domain.calendar import local_midnight_utc
from app.domain.enums import NodeState, SessionKind, XpReason
from app.domain.path import FINISHED_STATES, newly_unlocked
from app.domain.session_flow import ItemFacts
from app.domain.streak import StreakState, is_milestone
from app.models import LessonSession
from app.repositories import ledger_repo, play_repo
from app.schemas.completion import (
    CompletionDailyGoal,
    CompletionLeague,
    CompletionNode,
    CompletionReceipt,
    CompletionStats,
    CompletionStreak,
    CompletionXp,
    StreakDayOut,
    TimedResultOut,
    XpLineOut,
)
from app.services import league_service, path_service, streak_service
from app.services.context import RequestContext
from app.services.league_service import LeagueWeek
from app.services.path_service import PathSnapshot
from app.services.rewards import RewardEffects
from app.services.session_views import item_facts

RECENT_DAYS = 7  # recentSessionCount covers today and the six local days before it


@dataclass(frozen=True)
class Before:
    """What the receipt compares against: the learner's state just before the session counted."""

    path: PathSnapshot | None  # only for sessions played on a path node
    streak: StreakState
    xp_today: int
    league_rank: int | None  # None until the learner joins this week's cohort


@dataclass(frozen=True)
class After:
    """The learner's state once the rewards are paid."""

    path: PathSnapshot
    streak: StreakState
    xp_today: int
    league: LeagueWeek
    streak_week: list[StreakDayOut]  # the last seven local days
    recent_sessions: int  # completed sessions over the last seven local days


def capture_before(db: Session, ctx: RequestContext, session: LessonSession) -> Before:
    """Read the learner's state before the session is marked completed."""
    standing = league_service.current_standing(db, ctx.user.id, ctx.now)
    return Before(
        path=path_service.snapshot(db, ctx.user) if session.node_id is not None else None,
        streak=streak_service.state_of(ctx.stats),
        xp_today=ledger_repo.xp_on(db, ctx.user.id, ctx.today),
        league_rank=None if standing is None else standing.mine.rank,
    )


def capture_after(db: Session, ctx: RequestContext, path_after: PathSnapshot) -> After:
    """Read the learner's state after the rewards; `path_after` is their path once completed."""
    recent_since = local_midnight_utc(ctx.today - timedelta(days=RECENT_DAYS - 1), ctx.user.timezone)
    return After(
        path=path_after,
        streak=streak_service.state_of(ctx.stats),
        xp_today=ledger_repo.xp_on(db, ctx.user.id, ctx.today),
        league=league_service.this_week(db, ctx),
        streak_week=streak_service.week(db, ctx.user.id, ctx.today),
        recent_sessions=play_repo.count_completed_sessions(db, ctx.user.id, ended_since=recent_since),
    )


def build(
    session: LessonSession,
    before: Before,
    after: After,
    effects: RewardEffects,
    *,
    goal_xp: int,
    now: datetime,
) -> CompletionReceipt:
    """The receipt of a completed session, from the snapshots around its rewards."""
    items = item_facts(session)
    return CompletionReceipt(
        session_id=session.id,
        kind=session.kind,
        replayed=False,
        xp=CompletionXp(
            total=sum(line.amount for line in effects.xp_lines),
            lines=[XpLineOut(reason=line.reason, amount=line.amount) for line in effects.xp_lines],
            boost_active=any(line.reason == XpReason.BOOST for line in effects.xp_lines),
        ),
        stats=_stats(session, items),
        streak=CompletionStreak(
            before=before.streak.current,
            after=after.streak.current,
            extended_today=effects.streak_extended,
            is_new_record=after.streak.current > before.streak.longest,
            milestone=effects.streak_extended and is_milestone(after.streak.current),
            week=after.streak_week,
        ),
        daily_goal=CompletionDailyGoal(
            goal_xp=goal_xp,
            before=before.xp_today,
            after=after.xp_today,
            just_met=before.xp_today < goal_xp <= after.xp_today,
        ),
        node=_node(session, before.path, after.path),
        hearts_gained=effects.hearts_gained,
        quests_completed=effects.quests_completed,
        achievements_unlocked=effects.achievements_unlocked,
        league=_league(
            before.league_rank,
            after.league,
            joined_now=effects.league_join is not None and effects.league_join.joined_now,
        ),
        timed=_timed(session, items, now),
        recent_session_count=after.recent_sessions,
    )


def _stats(session: LessonSession, items: list[ItemFacts]) -> CompletionStats:
    """The stat cards: accuracy, time taken, mistakes and the longest run of right answers."""
    if session.ended_at is None:
        raise ValueError(f"session {session.id} has not ended")
    mistakes = session_flow.mistakes(items)
    return CompletionStats(
        accuracy_percent=session_flow.accuracy_percent(items),
        duration_seconds=int((session.ended_at - session.started_at).total_seconds()),
        mistakes=mistakes,
        best_combo=session_flow.best_combo(items),
        perfect=mistakes == 0,
        item_count=session_flow.initial_count(items),
    )


def _node(
    session: LessonSession, before: PathSnapshot | None, after: PathSnapshot | None
) -> CompletionNode | None:
    """The played node's progress, and every node this completion unlocked, in path order."""
    if session.node_id is None or before is None or after is None:
        return None
    node, facts = after.node(session.node_id), after.facts[session.node_id]
    if node is None:
        raise ValueError(f"node {session.node_id} is not on the learner's path")
    was, now = before.states[node.id], after.states[node.id]
    return CompletionNode(
        id=node.id,
        kind=node.kind,
        title=node.title,
        lessons_completed=facts.lessons_completed,
        lesson_count=facts.lesson_count,
        completed_now=was not in FINISHED_STATES and now in FINISHED_STATES,
        legendary_now=was != NodeState.LEGENDARY and now == NodeState.LEGENDARY,
        unlocked_node_ids=newly_unlocked(before.states, after.states),
    )


def _league(rank_before: int | None, after: LeagueWeek, *, joined_now: bool) -> CompletionLeague | None:
    """The learner's rank before and after; None while they have no cohort this week."""
    if after.standing is None:
        return None
    return CompletionLeague(
        joined_now=joined_now,
        league=league_service.badge(after.league),
        weekly_xp=after.standing.mine.xp,
        rank_before=rank_before,
        rank_after=after.standing.mine.rank,
    )


def _timed(session: LessonSession, items: list[ItemFacts], now: datetime) -> TimedResultOut | None:
    """Timed practice's result: right answers, answers given, and whether the clock ran out."""
    if session.kind != SessionKind.TIMED:
        return None
    return TimedResultOut(
        correct=session_flow.correct_count(items),
        answered=session_flow.answered_count(items),
        time_up=session.expires_at is not None and now >= session.expires_at,
    )
