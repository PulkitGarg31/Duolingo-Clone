"""The FastAPI application: middleware, CORS, error handling, routes and the startup sequence.

Run with `uvicorn app.main:app` and a single worker: SQLite takes one writer at a time.
"""

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any
from uuid import uuid4

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.deps import BootInfo
from app.api.middleware import REQUEST_ID_HEADER, BodyLimitMiddleware, RequestIdMiddleware
from app.api.problems import register_problem_handlers, use_problem_media_type
from app.api.v1.router import API_V1_PREFIX, OPENAPI_TAGS, api_v1_router
from app.core.clock import SystemClock
from app.core.config import Settings, get_settings
from app.core.db import SessionLocal, create_tables, engine
from app.models import Base
from app.seed.loader import seed_if_empty
from app.services import reference

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Prepare the database before the first request: create the tables, seed it if it is empty, and
    read the course content and catalogues, so the first requests don't pay for that.

    The database is the environment's (the engine in app.core.db, which also created its folder).
    The host's disk is ephemeral, so a boot may well start from no file at all. A file left by a
    version with another schema is dropped and seeded again: there are no migrations.
    """
    if create_tables(engine, Base.metadata):
        logger.warning("the database was built for another schema: rebuilt it from scratch")
    with SessionLocal() as db:
        seeded_now = seed_if_empty(db, real_now=SystemClock().now(), settings=app.state.settings)
        db.commit()
        reference.warm(db)
    logger.info("database ready (seeded on this boot: %s)", seeded_now)
    yield


def create_app(settings: Settings | None = None) -> FastAPI:
    """Build the application, configured by `settings` (by default, the environment's).

    The same settings govern everything: CORS and logging, the startup seed, and the rules every
    request reads through the get_settings dependency (dev tools, the X-User-Id header). The
    database is always app.core.db's engine, set up from DATABASE_URL.
    """
    if settings is None:
        settings = get_settings()
    _configure_logging(settings)
    app = FastAPI(
        title="Owlingo API",
        version=settings.app_version,
        lifespan=lifespan,
        openapi_url=f"{API_V1_PREFIX}/openapi.json",
        docs_url=f"{API_V1_PREFIX}/docs",
        redoc_url=None,
        openapi_tags=OPENAPI_TAGS,
    )
    # One id per process: production builds a single app per process.
    app.state.boot = BootInfo(id=uuid4().hex, at=SystemClock().now())
    app.state.settings = settings
    app.dependency_overrides[get_settings] = lambda: settings

    # The last middleware added runs first: CORS, then request ids, then the body limit. Request ids run
    # inside CORSMiddleware, so the 500s they build still get CORS headers, and the body limit runs
    # inside request ids, so its problem carries one.
    app.add_middleware(BodyLimitMiddleware)
    app.add_middleware(RequestIdMiddleware, boot_id=app.state.boot.id)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_origin_regex=settings.cors_origin_regex or None,
        allow_methods=["GET", "POST", "PUT", "PATCH", "OPTIONS"],
        allow_headers=[
            "Authorization",
            "Content-Type",
            "Idempotency-Key",
            REQUEST_ID_HEADER,
            *(["X-User-Id"] if settings.allow_user_header else []),
        ],
        expose_headers=["Location", REQUEST_ID_HEADER, "X-Server-Time", "X-Boot-Id"],
        allow_credentials=False,
        max_age=600,
    )
    register_problem_handlers(app)
    app.include_router(api_v1_router, prefix=API_V1_PREFIX)
    _document_problem_media_type(app)
    return app


def _document_problem_media_type(app: FastAPI) -> None:
    """Make the generated OpenAPI document list error bodies as application/problem+json."""
    generate = app.openapi

    def openapi() -> dict[str, Any]:
        return use_problem_media_type(generate())  # FastAPI caches the generated schema

    app.openapi = openapi  # type: ignore[method-assign]


def _configure_logging(settings: Settings) -> None:
    """Send the app's log lines (one per request, plus errors) to stderr at the configured level."""
    app_logger = logging.getLogger("app")
    app_logger.setLevel(settings.log_level.upper())
    if not app_logger.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s %(message)s"))
        app_logger.addHandler(handler)


app = create_app()
