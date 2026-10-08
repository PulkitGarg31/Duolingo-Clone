"""RequestIdMiddleware: request ids, the standard response headers, the request log line and the 500 boundary.

It is a plain ASGI middleware (no BaseHTTPMiddleware), so it wraps the response without buffering it.
"""

import logging
import re
import time
from uuid import uuid4

from starlette.datastructures import Headers, MutableHeaders
from starlette.requests import Request
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.api.problems import problem_response
from app.core.errors import InternalError
from app.schemas.base import format_instant

REQUEST_ID_HEADER = "X-Request-ID"
# An incoming id is echoed only if it is short and plain, so it is safe in headers and log lines.
_VALID_REQUEST_ID = re.compile(r"[A-Za-z0-9._-]{1,64}")

logger = logging.getLogger(__name__)


def new_request_id() -> str:
    """A fresh 12-hex-digit request id."""
    return uuid4().hex[:12]


class RequestIdMiddleware:
    """Gives every request an id and every response the standard headers:

    - X-Request-ID: the caller's id when it sent a valid one, otherwise a new one;
    - X-Boot-Id: this process's id, so clients notice a restart (and the re-seed it implies);
    - X-Server-Time: the request's `now`, when the request resolved one;
    - Cache-Control: no-store, unless the route chose its own caching.

    It also turns an unhandled exception into the 500 problem. Starlette's own last-resort handler
    sits outside CORSMiddleware, so its response would lack CORS headers and a browser would hide
    it; this middleware sits inside CORSMiddleware, so the 500 keeps them.
    """

    def __init__(self, app: ASGIApp, *, boot_id: str) -> None:
        self.app = app
        self.boot_id = boot_id

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        incoming = Headers(scope=scope).get(REQUEST_ID_HEADER, "")
        request_id = incoming if _VALID_REQUEST_ID.fullmatch(incoming) else new_request_id()
        state = scope.setdefault("state", {})  # the dict behind request.state
        state["request_id"] = request_id
        started = time.perf_counter()
        status_code = 500  # what the log line reports if no response ever starts
        response_started = False

        async def send_with_headers(message: Message) -> None:
            nonlocal status_code, response_started
            if message["type"] == "http.response.start":
                response_started = True
                status_code = message["status"]
                headers = MutableHeaders(scope=message)
                headers[REQUEST_ID_HEADER] = request_id
                headers["X-Boot-Id"] = self.boot_id
                if (now := state.get("now")) is not None:
                    headers["X-Server-Time"] = format_instant(now)
                headers.setdefault("Cache-Control", "no-store")
            await send(message)

        try:
            await self.app(scope, receive, send_with_headers)
        except Exception:
            logger.exception("unhandled error request_id=%s", request_id)
            if response_started:  # too late for an error response; let the server drop the connection
                raise
            path = Request(scope).url.path
            response = problem_response(InternalError(), instance=path, request_id=request_id)
            await response(scope, receive, send_with_headers)
        finally:
            logger.info(
                "method=%s path=%s status=%d duration_ms=%.1f request_id=%s",
                scope["method"],
                scope["path"],
                status_code,
                (time.perf_counter() - started) * 1000,
                request_id,
            )
