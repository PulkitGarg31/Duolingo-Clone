"""Daily quests: GET /me/quests."""

from fastapi import APIRouter

from app.api.deps import CtxDep, DbDep
from app.api.problems import problem_responses
from app.schemas.quests import QuestsOut
from app.services import quest_service

router = APIRouter(tags=["quests"])


@router.get(
    "/me/quests",
    response_model=QuestsOut,
    operation_id="getQuests",
    summary="Today's daily quests",
    responses=problem_responses(403, 404),
)
def get_quests(db: DbDep, ctx: CtxDep) -> QuestsOut:
    """Today's three quests and their progress. Rewards are paid when a session completes a quest."""
    return quest_service.todays_view(db, ctx)
