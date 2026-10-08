"""RFC 9457 problem details: the one body shape of every error response."""

from datetime import datetime

from app.core.errors import ErrorCode
from app.domain.enums import EndReason, SessionStatus
from app.schemas.base import ApiModel


class FieldError(ApiModel):
    """One invalid input: its path (with the names the client sent), a message and a machine kind."""

    field: str
    message: str
    kind: str


class ProblemDetails(ApiModel):
    """An error response. The frontend switches on `code`; `detail` is written for learners.

    The extension members after `errors` appear only for the codes that define them, and are left
    out of the JSON otherwise.
    """

    type: str  # "/problems/<kebab-case code>"
    title: str
    status: int
    detail: str
    instance: str  # the request path
    code: ErrorCode
    request_id: str
    errors: list[FieldError]  # non-empty only for VALIDATION_ERROR
    next_heart_at: datetime | None = None  # OUT_OF_HEARTS
    required_gems: int | None = None  # INSUFFICIENT_GEMS
    balance: int | None = None  # INSUFFICIENT_GEMS
    session_status: SessionStatus | None = None  # SESSION_NOT_ACTIVE
    end_reason: EndReason | None = None  # SESSION_NOT_ACTIVE
    expires_at: datetime | None = None  # SESSION_EXPIRED
    current_item_id: int | None = None  # ITEM_OUT_OF_ORDER
