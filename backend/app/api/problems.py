"""Every error becomes an RFC 9457 problem document (application/problem+json).

Four handlers cover every failure: application errors, request validation errors, Starlette's
HTTP errors (unknown route, wrong method) and, as a backstop, any other exception.
"""

import logging
from collections.abc import Mapping, Sequence
from http import HTTPStatus
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException

from app.core.errors import (
    AppError,
    BodyTooLarge,
    InternalError,
    MethodNotAllowed,
    NotFound,
    ValidationFailed,
)
from app.schemas.problems import FieldError, ProblemDetails

PROBLEM_JSON = "application/problem+json"
# A validation problem lists at most this many field errors. A body with thousands of bad values
# would otherwise get a response many times its own size.
MAX_FIELD_ERRORS = 20

logger = logging.getLogger(__name__)


def problem_response(
    error: AppError,
    *,
    instance: str,
    request_id: str,
    errors: Sequence[FieldError] = (),
    headers: Mapping[str, str] | None = None,
) -> JSONResponse:
    """The problem document for `error`, with its extension members when it has any."""
    problem = ProblemDetails.model_validate(
        {
            "type": f"/problems/{error.code.lower().replace('_', '-')}",
            "title": error.title,
            "status": error.status,
            "detail": error.detail,
            "instance": instance,
            "code": error.code,
            "requestId": request_id,
            "errors": list(errors),
            **error.extra,
        }
    )
    return JSONResponse(
        # exclude_unset leaves out the extension members this error does not define.
        problem.model_dump(mode="json", exclude_unset=True),
        status_code=error.status,
        media_type=PROBLEM_JSON,
        headers=headers,
    )


def problem_responses(*statuses: int) -> dict[int | str, dict[str, Any]]:
    """OpenAPI documentation of the problem responses a route can return, e.g. problem_responses(404, 409)."""
    return {
        status: {"model": ProblemDetails, "description": HTTPStatus(status).phrase} for status in statuses
    }


# Every route documents these, so FastAPI does not add its own (differently shaped) 422 schema.
DEFAULT_PROBLEM_RESPONSES: dict[int | str, dict[str, Any]] = {
    "4XX": {"model": ProblemDetails, "description": "Client error"},
    "5XX": {"model": ProblemDetails, "description": "Server error"},
}


def use_problem_media_type(openapi_schema: dict[str, Any]) -> dict[str, Any]:
    """Document error bodies under application/problem+json, the media type they are sent with.

    FastAPI documents every additional response as application/json; this renames that entry for
    4xx and 5xx responses. Running it twice changes nothing.
    """
    for path_item in openapi_schema.get("paths", {}).values():
        for operation in path_item.values():
            for status, response in operation.get("responses", {}).items():
                content = response.get("content", {})
                if status.startswith(("4", "5")) and "application/json" in content:
                    content[PROBLEM_JSON] = content.pop("application/json")
    return openapi_schema


def _request_id(request: Request) -> str:
    # RequestIdMiddleware sets it first thing; only a failure outside that middleware leaves it unset.
    return getattr(request.state, "request_id", None) or "unassigned"


def _render(
    request: Request,
    error: AppError,
    *,
    errors: Sequence[FieldError] = (),
    headers: Mapping[str, str] | None = None,
) -> JSONResponse:
    return problem_response(
        error, instance=request.url.path, request_id=_request_id(request), errors=errors, headers=headers
    )


async def _app_error(request: Request, exc: AppError) -> JSONResponse:
    return _render(request, exc)


async def _validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
    # Pydantic's location joined with dots, using the names the client sent: "body.dailyGoalXp".
    errors = [
        FieldError(
            field=".".join(str(part) for part in error["loc"]), message=error["msg"], kind=error["type"]
        )
        for error in exc.errors()[:MAX_FIELD_ERRORS]
    ]
    return _render(request, ValidationFailed(), errors=errors)


# Routing raises 404 for an unknown path and 405 for a wrong method, and BodyLimitMiddleware raises
# 413 for a streamed body past the limit. The only other client error raised here is 400 for a
# request body that cannot be read. The contract reports both of the last two as validation errors.
_HTTP_ERRORS: dict[int, type[AppError]] = {404: NotFound, 405: MethodNotAllowed, 413: BodyTooLarge}


async def _http_error(request: Request, exc: HTTPException) -> JSONResponse:
    error_class = _HTTP_ERRORS.get(exc.status_code) or (
        InternalError if exc.status_code >= 500 else ValidationFailed
    )
    return _render(request, error_class(), headers=exc.headers)  # keeps "Allow" on a 405


async def _unexpected_error(request: Request, exc: Exception) -> JSONResponse:
    request_id = _request_id(request)
    logger.error("unhandled error request_id=%s", request_id, exc_info=exc)
    return problem_response(InternalError(), instance=request.url.path, request_id=request_id)


def register_problem_handlers(app: FastAPI) -> None:
    """Install the four handlers. The last one only runs if RequestIdMiddleware itself fails."""
    app.add_exception_handler(AppError, _app_error)
    app.add_exception_handler(RequestValidationError, _validation_error)
    app.add_exception_handler(HTTPException, _http_error)
    app.add_exception_handler(Exception, _unexpected_error)
