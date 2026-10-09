"""The learning path: GET /me/path and opening chests."""

from typing import Annotated

from fastapi import APIRouter

from app.api.deps import CtxDep, DbDep, id_path
from app.api.problems import problem_responses
from app.schemas.path import ChestClaimOut, PathOut
from app.services import path_service

router = APIRouter(tags=["path"])


@router.get(
    "/me/path",
    response_model=PathOut,
    operation_id="getPath",
    summary="The learning path",
    responses=problem_responses(403, 404),
)
def get_path(db: DbDep, ctx: CtxDep) -> PathOut:
    """Units and their nodes in path order, each with its state, crown, progress and actions."""
    return path_service.path_view(db, ctx)


@router.post(
    "/me/chests/{nodeId}/claim",
    response_model=ChestClaimOut,
    operation_id="claimChest",
    summary="Open a chest",
    responses=problem_responses(403, 404, 409, 422),
)
def claim_chest(node_id: Annotated[int, id_path("nodeId")], db: DbDep, ctx: CtxDep) -> ChestClaimOut:
    """Open a reachable chest for its gems. Claiming it again replays the first claim."""
    result = path_service.claim_chest(db, ctx, node_id)
    db.commit()
    return result
