"""Leagues: this week's leaderboard and acknowledging a finished week's result."""

from typing import Annotated

from fastapi import APIRouter

from app.api.deps import CtxDep, DbDep, id_path
from app.api.problems import problem_responses
from app.schemas.league import LeagueAckOut, LeagueOut
from app.services import league_service

router = APIRouter(tags=["league"])


@router.get(
    "/me/league",
    response_model=LeagueOut,
    operation_id="getLeague",
    summary="This week's leaderboard",
    responses=problem_responses(403, 404),
)
def get_league(db: DbDep, ctx: CtxDep) -> LeagueOut:
    """The tier ladder, this week's cohort standings once joined, and last week's result."""
    return league_service.league_view(db, ctx)


@router.post(
    "/me/league/results/{membershipId}/ack",
    response_model=LeagueAckOut,
    operation_id="ackLeagueResult",
    summary="Acknowledge a league result",
    responses=problem_responses(403, 404, 409, 422),
)
def ack_league_result(
    membership_id: Annotated[int, id_path("membershipId")], db: DbDep, ctx: CtxDep
) -> LeagueAckOut:
    """Mark a finished week's result modal as seen; repeating it keeps the first time."""
    result = league_service.ack_result(db, ctx, membership_id)
    db.commit()
    return result
