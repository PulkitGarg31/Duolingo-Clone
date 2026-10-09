"""The learner's own state: GET /me, settings and the activity history."""

from datetime import date
from typing import Annotated

from fastapi import APIRouter, Query, Request

from app.api.deps import CtxDep, DbDep
from app.api.problems import problem_responses
from app.schemas.me import ActivityOut, MeOut
from app.schemas.settings import SettingsOut, SettingsPatchIn, SettingsUpdateOut
from app.services import me_service, profile_service, settings_service

router = APIRouter(tags=["me"])


@router.get(
    "/me",
    response_model=MeOut,
    operation_id="getMe",
    summary="The learner's state",
    responses=problem_responses(403, 404),
)
def get_me(db: DbDep, ctx: CtxDep) -> MeOut:
    """Everything the app shell shows: top bar stats, daily goal, league card and pending modals."""
    return me_service.build_me(db, ctx)


@router.get(
    "/me/settings",
    response_model=SettingsOut,
    operation_id="getSettings",
    summary="The learner's preferences",
    responses=problem_responses(403, 404),
)
def get_settings(ctx: CtxDep) -> SettingsOut:
    """Daily goal, theme, sound and other preferences, plus the learner's time zone."""
    return settings_service.current(ctx)


@router.patch(
    "/me/settings",
    response_model=SettingsUpdateOut,
    operation_id="updateSettings",
    summary="Change preferences",
    responses=problem_responses(403, 404, 422),
)
def update_settings(body: SettingsPatchIn, request: Request, db: DbDep, ctx: CtxDep) -> SettingsUpdateOut:
    """Update only the fields sent. A time zone change reports what it did: the streak dates shifted,
    or the untouched sample history was rebuilt in the new zone."""
    result = settings_service.update(db, ctx, body)
    db.commit()
    request.state.now = result.now  # a rebuild puts the clock back on real time
    return result.out


@router.get(
    "/me/activity",
    response_model=ActivityOut,
    operation_id="getActivity",
    summary="Day-by-day activity",
    responses=problem_responses(403, 404, 422),
)
def get_activity(
    db: DbDep,
    ctx: CtxDep,
    from_: Annotated[
        date | None, Query(alias="from", description="First local day; defaults to 34 days before `to`.")
    ] = None,
    to: Annotated[date | None, Query(description="Last local day; defaults to today.")] = None,
) -> ActivityOut:
    """XP, the goal in force and how each local day counted for the streak (at most 92 days)."""
    return profile_service.activity(db, ctx, from_, to)
