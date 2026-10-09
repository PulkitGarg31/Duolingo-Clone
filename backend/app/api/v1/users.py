"""Profiles: GET /users/{userId}/profile, for learners and league bots alike."""

from fastapi import APIRouter

from app.api.deps import CtxDep, DbDep, UserRef
from app.api.problems import problem_responses
from app.schemas.profile import ProfileOut
from app.services import profile_service

router = APIRouter(tags=["profile"])


@router.get(
    "/users/{userId}/profile",
    response_model=ProfileOut,
    operation_id="getProfile",
    summary="A profile",
    responses=problem_responses(403, 404, 422),
)
def get_profile(user_id: UserRef, db: DbDep, ctx: CtxDep) -> ProfileOut:
    """Profile stats and every achievement of a learner or a league bot."""
    return profile_service.profile(db, ctx, user_id)
