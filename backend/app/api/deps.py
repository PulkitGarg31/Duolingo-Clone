"""Request dependencies: the database session, the clock, the current learner and the request context,
plus the one rule for ids sent in the URL or in a header.

FastAPI resolves each dependency at most once per request and shares the result, which is what
gives a request exactly one session and one `now`.
"""

from collections.abc import Iterator
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Annotated, Literal

from fastapi import Depends, Header, Path, Request, params
from pydantic import Field, PlainValidator
from pydantic_core import PydanticCustomError
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
# Ids are SQLite integers, which are 64-bit: no row can have a larger id, and the database driver
# refuses to even send one. Rows are numbered from 1.
MAX_ID = 2**63 - 1


def parse_id(text: str) -> int | None:
    """`text` as an id (ASCII digits only, 1 to MAX_ID), or None when it can't be one."""
    if not (text.isascii() and text.isdigit()) or len(text) > len(str(MAX_ID)):
        return None
    value = int(text)
    return value if 1 <= value <= MAX_ID else None


def id_path(name: str) -> params.Path:
    """An id in the URL under its documented name ("sessionId"). An id out of range is a 422, like
    any other invalid input, rather than a query the database can't run."""
    return Path(alias=name, ge=1, le=MAX_ID)


def _user_ref(value: object) -> int | Literal["me"]:
    if value == "me":
        return "me"
    user_id = parse_id(value) if isinstance(value, str) else None
    if user_id is None:
        raise PydanticCustomError("user_ref", "Input should be a user id or 'me'")
    return user_id


# A profile's user: an id or `me`. One validator reads both forms, so a bad value gets one error.
UserRef = Annotated[
    int | Literal["me"],
    PlainValidator(
        _user_ref,
        json_schema_input_type=Annotated[int, Field(ge=1, le=MAX_ID)] | Literal["me"],
    ),
    Path(alias="userId", description="A user id, or `me` for the learner."),
]


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
    user_id = parse_id(raw_id)
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
    when the handler then fails (with a 409, say). Another request of the same learner (a second
    tab) can run and commit in full between that commit and the handler. So everything read so far
    is expired here: the handler reads the learner's rows again when it first uses them, inside its
    own transaction, which holds the write lock until the router commits. `now` and `today` stay
    the request's single instant.
    """
    stats = user.stats
    if stats is None:  # every human learner is created with stats; bots were refused above
        raise RuntimeError(f"learner {user.id} has no stats row")
    sync_service.bring_to_now(db, user, now, settings)
    db.commit()
    today = local_date(now, user.timezone)
    db.expire_all()
    return RequestContext(user=user, stats=stats, now=now, today=today, settings=settings)


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
