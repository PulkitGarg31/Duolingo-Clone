"""Application errors and their stable codes.

Every failure the API reports is an `AppError` subclass: a stable machine-readable `code`, an HTTP
`status`, a short `title`, a learner-friendly `detail` and, for a few codes, extension members.
Services raise them; the API layer renders them as RFC 9457 problem documents. This module
deliberately knows nothing about the web framework.
"""

from collections.abc import Mapping
from datetime import datetime
from enum import StrEnum
from typing import ClassVar

from app.domain.enums import EndReason, SessionStatus
from app.domain.rules import MAX_STREAK_FREEZES

# Extension members are scalars; datetimes are serialized as ISO-8601 UTC by the API layer.
ProblemValue = str | int | datetime | None


class ErrorCode(StrEnum):
    """Stable error codes the frontend switches on."""

    VALIDATION_ERROR = "VALIDATION_ERROR"
    INVALID_ANSWER = "INVALID_ANSWER"
    IDEMPOTENCY_KEY_REUSED = "IDEMPOTENCY_KEY_REUSED"
    IDEMPOTENCY_KEY_REQUIRED = "IDEMPOTENCY_KEY_REQUIRED"
    NOT_FOUND = "NOT_FOUND"
    METHOD_NOT_ALLOWED = "METHOD_NOT_ALLOWED"
    BOT_ACCOUNT = "BOT_ACCOUNT"
    DEV_TOOLS_DISABLED = "DEV_TOOLS_DISABLED"
    NODE_LOCKED = "NODE_LOCKED"
    NODE_NOT_PLAYABLE = "NODE_NOT_PLAYABLE"
    NODE_ALREADY_COMPLETED = "NODE_ALREADY_COMPLETED"
    ALREADY_LEGENDARY = "ALREADY_LEGENDARY"
    NOTHING_TO_PRACTICE = "NOTHING_TO_PRACTICE"
    CHEST_LOCKED = "CHEST_LOCKED"
    OUT_OF_HEARTS = "OUT_OF_HEARTS"
    INSUFFICIENT_GEMS = "INSUFFICIENT_GEMS"
    HEARTS_ALREADY_FULL = "HEARTS_ALREADY_FULL"
    MAX_FREEZES_EQUIPPED = "MAX_FREEZES_EQUIPPED"
    ITEM_UNAVAILABLE = "ITEM_UNAVAILABLE"
    SESSION_NOT_ACTIVE = "SESSION_NOT_ACTIVE"
    SESSION_EXPIRED = "SESSION_EXPIRED"
    SESSION_INCOMPLETE = "SESSION_INCOMPLETE"
    ITEM_OUT_OF_ORDER = "ITEM_OUT_OF_ORDER"
    ITEM_ALREADY_ANSWERED = "ITEM_ALREADY_ANSWERED"
    LEAGUE_RESULT_NOT_READY = "LEAGUE_RESULT_NOT_READY"
    INTERNAL_ERROR = "INTERNAL_ERROR"


class AppError(Exception):
    """Base class of every reportable failure. Concrete subclasses fix code, status and title."""

    code: ClassVar[ErrorCode]
    status: ClassVar[int]
    title: ClassVar[str]
    default_detail: ClassVar[str]

    def __init__(self, detail: str | None = None, *, extra: Mapping[str, ProblemValue] | None = None) -> None:
        self.detail = detail or self.default_detail
        # Extension members, keyed by their camelCase wire names.
        self.extra: dict[str, ProblemValue] = dict(extra or {})
        super().__init__(self.detail)


# ---- status families ----


class BadRequest(AppError):
    status = 400


class Forbidden(AppError):
    status = 403


class Conflict(AppError):
    """The request is well-formed, but the learner's current state forbids it."""

    status = 409


class Unprocessable(AppError):
    """The body is well-formed JSON but inconsistent with the resource it targets."""

    status = 422


# ---- 400 / 403 / 404 / 405 ----


class IdempotencyKeyRequired(BadRequest):
    code = ErrorCode.IDEMPOTENCY_KEY_REQUIRED
    title = "Idempotency key required"
    default_detail = "Send an Idempotency-Key header of at most 64 characters with every purchase."


class BotAccount(Forbidden):
    code = ErrorCode.BOT_ACCOUNT
    title = "Bot account"
    default_detail = "League competitors can't be used as learner accounts."


class DevToolsDisabled(Forbidden):
    code = ErrorCode.DEV_TOOLS_DISABLED
    title = "Dev tools disabled"
    default_detail = "Demo tools are turned off on this server."


class NotFound(AppError):
    status = 404
    code = ErrorCode.NOT_FOUND
    title = "Not found"
    default_detail = "We couldn't find what you were looking for."


class MethodNotAllowed(AppError):
    status = 405
    code = ErrorCode.METHOD_NOT_ALLOWED
    title = "Method not allowed"
    default_detail = "This endpoint doesn't support that HTTP method."


# ---- 409: the path ----


class NodeLocked(Conflict):
    code = ErrorCode.NODE_LOCKED
    title = "Node locked"
    default_detail = "Complete the earlier lessons on the path to unlock this one."


class NodeNotPlayable(Conflict):
    code = ErrorCode.NODE_NOT_PLAYABLE
    title = "Node not playable"
    default_detail = "This stop on the path can't be played that way."


class NodeAlreadyCompleted(Conflict):
    code = ErrorCode.NODE_ALREADY_COMPLETED
    title = "Node already completed"
    default_detail = "You've already completed this skill. Practice it instead."


class AlreadyLegendary(Conflict):
    code = ErrorCode.ALREADY_LEGENDARY
    title = "Already legendary"
    default_detail = "This skill is already Legendary."


class NothingToPractice(Conflict):
    code = ErrorCode.NOTHING_TO_PRACTICE
    title = "Nothing to practice"
    default_detail = "Complete a lesson first, then come back to practice."


class ChestLocked(Conflict):
    code = ErrorCode.CHEST_LOCKED
    title = "Chest locked"
    default_detail = "Reach this chest on the path before opening it."


# ---- 409: hearts, gems and the shop ----


class OutOfHearts(Conflict):
    code = ErrorCode.OUT_OF_HEARTS
    title = "Out of hearts"
    default_detail = "You have no hearts left. Refill your hearts or practice to earn one."

    def __init__(self, next_heart_at: datetime | None, *, detail: str | None = None) -> None:
        super().__init__(detail, extra={"nextHeartAt": next_heart_at})


class InsufficientGems(Conflict):
    code = ErrorCode.INSUFFICIENT_GEMS
    title = "Not enough gems"
    default_detail = "You don't have enough gems for that."

    def __init__(self, required_gems: int, balance: int, *, detail: str | None = None) -> None:
        super().__init__(detail, extra={"requiredGems": required_gems, "balance": balance})


class HeartsAlreadyFull(Conflict):
    code = ErrorCode.HEARTS_ALREADY_FULL
    title = "Hearts already full"
    default_detail = "Your hearts are already full."


class MaxFreezesEquipped(Conflict):
    code = ErrorCode.MAX_FREEZES_EQUIPPED
    title = "Maximum freezes equipped"
    default_detail = f"You already have {MAX_STREAK_FREEZES} Streak Freezes equipped, the most you can hold."


class ItemUnavailable(Conflict):
    code = ErrorCode.ITEM_UNAVAILABLE
    title = "Item unavailable"
    default_detail = "This item is coming soon."


# ---- 409: sessions ----


class SessionNotActive(Conflict):
    code = ErrorCode.SESSION_NOT_ACTIVE
    title = "Session not active"
    default_detail = "This session has already ended."

    def __init__(
        self, session_status: SessionStatus, end_reason: EndReason | None, *, detail: str | None = None
    ) -> None:
        # Not "status": RFC 9457 reserves that member for the HTTP status code.
        super().__init__(detail, extra={"sessionStatus": session_status, "endReason": end_reason})


class SessionExpired(Conflict):
    code = ErrorCode.SESSION_EXPIRED
    title = "Session expired"
    default_detail = "Time's up for this session. Finish it to see your results."

    def __init__(self, expires_at: datetime, *, detail: str | None = None) -> None:
        super().__init__(detail, extra={"expiresAt": expires_at})


class SessionIncomplete(Conflict):
    code = ErrorCode.SESSION_INCOMPLETE
    title = "Session incomplete"
    default_detail = "Answer every exercise before finishing the session."


class ItemOutOfOrder(Conflict):
    code = ErrorCode.ITEM_OUT_OF_ORDER
    title = "Item out of order"
    default_detail = "Answer the current exercise first."

    def __init__(self, current_item_id: int | None, *, detail: str | None = None) -> None:
        super().__init__(detail, extra={"currentItemId": current_item_id})


class ItemAlreadyAnswered(Conflict):
    code = ErrorCode.ITEM_ALREADY_ANSWERED
    title = "Item already answered"
    default_detail = "This exercise was already answered with a different answer."


class LeagueResultNotReady(Conflict):
    code = ErrorCode.LEAGUE_RESULT_NOT_READY
    title = "League result not ready"
    default_detail = "This league week hasn't finished yet."


# ---- 422 ----


class ValidationFailed(Unprocessable):
    """The request failed schema validation; the API layer adds the per-field errors."""

    code = ErrorCode.VALIDATION_ERROR
    title = "Validation error"
    default_detail = "Some fields are missing or invalid."


class InvalidAnswer(Unprocessable):
    code = ErrorCode.INVALID_ANSWER
    title = "Invalid answer"
    default_detail = "That answer doesn't fit this exercise."


class IdempotencyKeyReused(Unprocessable):
    code = ErrorCode.IDEMPOTENCY_KEY_REUSED
    title = "Idempotency key reused"
    default_detail = "This Idempotency-Key was already used to buy a different item."


# ---- 500 ----


class InternalError(AppError):
    """Anything unexpected. The detail stays generic; the traceback is only logged."""

    status = 500
    code = ErrorCode.INTERNAL_ERROR
    title = "Internal server error"
    default_detail = "Something went wrong on our side. Please try again."
