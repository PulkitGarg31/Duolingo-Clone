"""Probe routes for the API's error paths, and the helpers the contract tests share.

The routes are mounted on an app of their own (the `api` fixture of tests/api/conftest.py), so every
failure passes through the same middleware, CORS and exception handlers as production traffic.
"""

from datetime import timedelta

from fastapi import APIRouter, Depends, FastAPI, Response
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.api.deps import CtxDep, IdempotencyKeyDep, require_dev_tools
from app.api.v1.router import API_V1_PREFIX
from app.core.config import Settings, get_settings
from app.core.errors import (
    AlreadyLegendary,
    AppError,
    BodyTooLarge,
    BotAccount,
    ChestLocked,
    DevToolsDisabled,
    ErrorCode,
    HeartsAlreadyFull,
    IdempotencyKeyRequired,
    IdempotencyKeyReused,
    InsufficientGems,
    InternalError,
    InvalidAnswer,
    ItemAlreadyAnswered,
    ItemOutOfOrder,
    ItemUnavailable,
    LeagueResultNotReady,
    MaxFreezesEquipped,
    MethodNotAllowed,
    NodeAlreadyCompleted,
    NodeLocked,
    NodeNotPlayable,
    NotFound,
    NothingToPractice,
    OutOfHearts,
    SessionExpired,
    SessionIncomplete,
    SessionNotActive,
    ValidationFailed,
)
from app.domain.enums import EndReason, SessionStatus
from app.models import BotProfile, Course, League, User, UserSettings, UserStats
from app.schemas.base import ApiModel
from app.schemas.common import DailyGoalXp
from app.schemas.sessions import AnswerIn
from tests.conftest import (
    FROZEN_NOW,
)


def sample_errors() -> list[AppError]:
    """One instance of every concrete application error, with realistic extension values."""
    return [
        ValidationFailed(),
        BodyTooLarge(),
        InvalidAnswer(),
        IdempotencyKeyReused(),
        IdempotencyKeyRequired(),
        NotFound(),
        MethodNotAllowed(),
        BotAccount(),
        DevToolsDisabled(),
        NodeLocked(),
        NodeNotPlayable(),
        NodeAlreadyCompleted(),
        AlreadyLegendary(),
        NothingToPractice(),
        ChestLocked(),
        OutOfHearts(next_heart_at=FROZEN_NOW + timedelta(hours=4)),
        InsufficientGems(required_gems=350, balance=120),
        HeartsAlreadyFull(),
        MaxFreezesEquipped(),
        ItemUnavailable(),
        SessionNotActive(session_status=SessionStatus.FAILED, end_reason=EndReason.TOO_MANY_MISTAKES),
        SessionExpired(expires_at=FROZEN_NOW + timedelta(seconds=30)),
        SessionIncomplete(),
        ItemOutOfOrder(current_item_id=103),
        ItemAlreadyAnswered(),
        LeagueResultNotReady(),
        InternalError(),
    ]


# ---- probe routes: one of each failure the API must render ----


class ProbeGoal(ApiModel):
    daily_goal_xp: DailyGoalXp


probe = APIRouter(prefix=f"{API_V1_PREFIX}/probe")


@probe.get("/errors/{code}")
def raise_app_error(code: ErrorCode) -> None:
    raise next(error for error in sample_errors() if error.code == code)


@probe.get("/crash")
def crash() -> None:
    raise RuntimeError("probe failure")


@probe.post("/goal")
def echo_goal(body: ProbeGoal) -> ProbeGoal:
    return body


@probe.put("/answer")
def accept_answer(body: AnswerIn) -> dict[str, str]:
    return {"type": body.type}


@probe.post("/purchase")
def read_idempotency_key(key: IdempotencyKeyDep) -> dict[str, str]:
    return {"key": key}


@probe.get("/dev", dependencies=[Depends(require_dev_tools)])
def dev_only() -> dict[str, bool]:
    return {"ok": True}


@probe.get("/me")
def whoami(ctx: CtxDep) -> dict[str, int | str]:
    return {"userId": ctx.user.id, "today": ctx.today.isoformat()}


@probe.get("/cached")
def cacheable(response: Response) -> dict[str, bool]:
    response.headers["Cache-Control"] = "public, max-age=300"
    return {"ok": True}


def client_settings(client: TestClient) -> Settings:
    """The settings the client's app is running with."""
    fastapi_app = client.app
    assert isinstance(fastapi_app, FastAPI)
    settings: Settings = fastapi_app.dependency_overrides[get_settings]()
    return settings


def add_people(db: Session) -> tuple[int, int]:
    """The default learner 'alex' (with stats and settings) and one league bot; returns their ids."""
    db.add(
        Course(
            id=1,
            slug="es-en",
            title="Spanish",
            learning_language="es",
            from_language="en",
            tts_locale="es-ES",
            flag_key="es",
            is_published=True,
            position=1,
        )
    )
    db.add(League(tier=1, name="Bronze", color="#D4A880", promote_count=20, demote_count=0))
    db.flush()
    alex = User(
        username="alex",
        display_name="Alex",
        avatar_color="#1CB0F6",
        timezone="Asia/Kolkata",
        current_course_id=1,
        joined_at=FROZEN_NOW,
        stats=UserStats(updated_at=FROZEN_NOW),
        settings=UserSettings(updated_at=FROZEN_NOW),
    )
    bot = User(
        username="kenji",
        display_name="Kenji T.",
        avatar_color="#FF9600",
        timezone="UTC",
        current_course_id=1,
        joined_at=FROZEN_NOW,
        bot_profile=BotProfile(daily_xp=30, rng_seed=7, baseline_xp=900, baseline_streak=12),
    )
    db.add_all([alex, bot])
    db.commit()
    return alex.id, bot.id
