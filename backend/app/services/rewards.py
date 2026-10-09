"""Completion rewards: everything a completed session earns, written in one transaction, in order."""

from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.domain import session_flow, xp
from app.domain.enums import SessionKind
from app.domain.rules import PRACTICE_HEART_REWARD
from app.domain.xp import XpLine
from app.models import LessonSession, XpEvent
from app.schemas.completion import AchievementUnlockOut, QuestCompletedOut
from app.services import achievement_service, hearts_service, league_service, quest_service, streak_service
from app.services.context import RequestContext
from app.services.league_service import LeagueJoin
from app.services.path_service import PathSnapshot
from app.services.session_views import item_facts


@dataclass(frozen=True)
class RewardEffects:
    """What a completion paid out, as the receipt reports it."""

    xp_lines: list[XpLine]
    streak_extended: bool  # this session is what counted today for the streak
    league_join: LeagueJoin | None  # None while leagues are locked or when no XP was earned
    hearts_gained: int
    quests_completed: list[QuestCompletedOut]
    achievements_unlocked: list[AchievementUnlockOut]  # the highest new level of each achievement


def apply_completion_rewards(
    db: Session, ctx: RequestContext, session: LessonSession, path_now: PathSnapshot
) -> RewardEffects:
    """Pay a just-completed session's rewards, in this order:

    1. one XP ledger row per XP line (the database allows each reason once per session);
    2. when XP was earned: today's streak credit, then this week's league membership;
    3. after practice: one heart back;
    4. daily quests that just reached their target, then newly reached achievement levels, both
       measured on the rows written above.
    The XP rows take the learner from the session row itself, so they can never be credited to
    anyone else. `path_now` is the learner's path with the session completed; no reward changes it.
    """
    lines = _xp_lines(ctx, session, path_now)
    db.add_all(
        XpEvent(
            user_id=session.user_id,
            session_id=session.id,
            reason=line.reason,
            amount=line.amount,
            earned_at=ctx.now,
            local_date=ctx.today,
        )
        for line in lines
    )
    earned_xp = sum(line.amount for line in lines) > 0
    extended = streak_service.credit(db, ctx) if earned_xp else False
    joined = league_service.ensure_membership(db, ctx) if earned_xp else None
    hearts = hearts_service.gain(ctx, PRACTICE_HEART_REWARD) if session.kind == SessionKind.PRACTICE else 0
    db.flush()  # quests and achievements are measured on the rows just written
    quests = quest_service.reward_newly_completed(db, ctx)
    unlocked = achievement_service.evaluate(
        db, ctx.user.id, ctx.now, session_id=session.id, path_now=path_now
    )
    return RewardEffects(lines, extended, joined, hearts, quests, unlocked)


def _xp_lines(ctx: RequestContext, session: LessonSession, path_now: PathSnapshot) -> list[XpLine]:
    """The session's XP lines: base XP by kind (a unit review pays more), combo bonus and boost."""
    items = item_facts(session)
    node = path_now.node(session.node_id) if session.node_id is not None else None
    return xp.session_xp_lines(
        session.kind,
        node_kind=None if node is None else node.kind,
        best_run=session_flow.best_combo(items),
        item_count=session_flow.initial_count(items),
        correct=session_flow.correct_count(items),
        boost_active=xp.is_boost_active(ctx.stats.xp_boost_until, ctx.now),
    )
