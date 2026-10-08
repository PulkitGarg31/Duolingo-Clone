"""Request dependencies: the database session, the clock, the current learner and the request context.

FastAPI resolves each dependency at most once per request and shares the result, which is what
gives a request exactly one session and one `now`.
"""

from collections.abc import Iterator
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Annotated

from fastapi import Depends, Header, Request
from sqlalchemy.orm import Session

from app.core.clock import Clock, OffsetClock, SystemClock
from app.core.config import Settings, get_settings
from app.core.db import SessionLocal
from app.core.errors import BotAccount, DevToolsDisabled, IdempotencyKeyRequired, NotFound
from app.domain.calendar import local_date
from app.models import User
from app.repositories import system_repo, user_repo
from app.services import sync_service
from app.services.context import RequestContext

MAX_IDEMPOTENCY_KEY_LENGTH = 64
_MAX_ID_DIGITS = 18  # keeps a parsed id inside SQLite's 64-bit integers


@dataclass(frozen=True)
class BootInfo:
    """Identifies this server process. A new id after a restart tells clients the demo was re-seeded."""

    id: str
    at: datetime


def get_db() -> Iterator[Session]:
    """The request's database session. Routers commit; whatever is left uncommitted is rolled back."""
    with SessionLocal() as db:
        yield db


DbDep = Annotated[Session, Depends(get_db)]
SettingsDep = Annotated[Settings, Depends(get_settings)]


def get_real_clock() -> Clock:
    """The source of real time. Tests replace this dependency with a FrozenClock."""
    return SystemClock()


def get_clock(db: DbDep, real_clock: Annotated[Clock, Depends(get_real_clock)]) -> Clock:
    """Simulated time: real time plus the demo clock's forward-only offset."""
    return OffsetClock(real_clock, timedelta(seconds=system_repo.offset_seconds(db)))


ClockDep = Annotated[Clock, Depends(get_clock)]


def get_now(request: Request, clock: ClockDep) -> datetime:
    """The request's single instant. The middleware also returns it in the X-Server-Time header."""
    now = clock.now()
    request.state.now = now
    return now


NowDep = Annotated[datetime, Depends(get_now)]


def get_boot(request: Request) -> BootInfo:
    """This process's identity, created with the app."""
    boot: BootInfo = request.app.state.boot
    return boot


BootDep = Annotated[BootInfo, Depends(get_boot)]


def is_seeded(db: DbDep) -> bool:
    """Whether the database holds the demo data; seeding writes the app_state row."""
    return system_repo.get_state(db) is not None


SeededDep = Annotated[bool, Depends(is_seeded)]


def get_current_user(
    db: DbDep,
    settings: SettingsDep,
    x_user_id: Annotated[str | None, Header(alias="X-User-Id", include_in_schema=False)] = None,
) -> User:
    """The learner making the request.

    There is no sign-in: requests act as the default learner. Where the setting allows it (local
    runs and tests), an X-User-Id header acts as another learner, which proves per-user isolation.
    """
    if settings.allow_user_header and x_user_id is not None:
        return _learner_with_id(db, x_user_id)
    user = user_repo.get_by_username(db, settings.default_username)
    if user is None:
        raise NotFound(f"The learner '{settings.default_username}' doesn't exist yet.")
    return user


def _learner_with_id(db: Session, raw_id: str) -> User:
    user_id = int(raw_id) if raw_id.isdecimal() and len(raw_id) <= _MAX_ID_DIGITS else None
    user = None if user_id is None else user_repo.get(db, user_id)
    if user is None:
        raise NotFound("There is no learner with that id.")
    if user_repo.is_bot(db, user.id):
        raise BotAccount()
    return user


CurrentUserDep = Annotated[User, Depends(get_current_user)]


def get_ctx(db: DbDep, user: CurrentUserDep, now: NowDep, settings: SettingsDep) -> RequestContext:
    """The request context, after catching the learner's state up to `now`.

    The catch-up is committed on its own, as the request's first unit of work, so it stands even
    when the handler then fails (with a 409, say).
    """
    stats = user.stats
    if stats is None:  # every human learner is created with stats; bots were refused above
        raise RuntimeError(f"learner {user.id} has no stats row")
    sync_service.bring_to_now(db, user, now, settings)
    db.commit()
    return RequestContext(
        user=user, stats=stats, now=now, today=local_date(now, user.timezone), settings=settings
    )


CtxDep = Annotated[RequestContext, Depends(get_ctx)]


def require_dev_tools(settings: SettingsDep) -> None:
    """Guards the /dev endpoints, which can be switched off by configuration."""
    if not settings.enable_dev_tools:
        raise DevToolsDisabled()


def idempotency_key(
    key: Annotated[
        str | None,
        Header(
            alias="Idempotency-Key", description="Required: a client-generated UUID, at most 64 characters."
        ),
    ] = None,
) -> str:
    """The purchase's Idempotency-Key: repeating a request with the same key replays the purchase."""
    key = (key or "").strip()
    if not key or len(key) > MAX_IDEMPOTENCY_KEY_LENGTH:
        raise IdempotencyKeyRequired()
    return key


IdempotencyKeyDep = Annotated[str, Depends(idempotency_key)]
