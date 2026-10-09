"""Public course content: the course menu and unit Guidebooks.

Neither depends on the learner, so neither syncs, and both may be cached for a few minutes.
"""

from typing import Annotated

from fastapi import APIRouter, Response

from app.api.deps import DbDep, id_path
from app.api.problems import problem_responses
from app.schemas.content import CoursesOut, GuidebookOut
from app.services import content_service

router = APIRouter(tags=["content"])

PUBLIC_CACHE = "public, max-age=300"


@router.get("/courses", response_model=CoursesOut, operation_id="listCourses", summary="The course menu")
def list_courses(response: Response, db: DbDep) -> CoursesOut:
    """Every course; unpublished ones are shown as coming soon."""
    response.headers["Cache-Control"] = PUBLIC_CACHE
    return content_service.courses(db)


@router.get(
    "/units/{unitId}/guidebook",
    response_model=GuidebookOut,
    operation_id="getGuidebook",
    summary="A unit's Guidebook",
    responses=problem_responses(404, 422),
)
def get_guidebook(unit_id: Annotated[int, id_path("unitId")], response: Response, db: DbDep) -> GuidebookOut:
    """A unit's key phrases and tips."""
    result = content_service.guidebook(db, unit_id)
    response.headers["Cache-Control"] = PUBLIC_CACHE
    return result
