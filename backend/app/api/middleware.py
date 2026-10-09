"""The app's two middlewares, both plain ASGI (no BaseHTTPMiddleware), so neither buffers a response.

- RequestIdMiddleware: request ids, the standard response headers, the request log line and the
  500 boundary.
- BodyLimitMiddleware: refuses request bodies far larger than any request of this API.
"""

import logging
import re
import time
from uuid import uuid4

from starlette.datastructures import Headers, MutableHeaders
from starlette.exceptions import HTTPException
from starlette.requests import Request
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.api.problems import problem_response
from app.core.errors import BodyTooLarge, InternalError
from app.schemas.base import format_instant

REQUEST_ID_HEADER = "X-Request-ID"
# An incoming id is echoed only if it is short and plain, so it is safe in headers and log lines.
_VALID_REQUEST_ID = re.compile(r"[A-Za-z0-9._-]{1,64}")
# Far above any real request body: the largest is an answer of at most 200 characters.
MAX_BODY_BYTES = 64 * 1024

logger = logging.getLogger(__name__)


def new_request_id() -> str:
    """A fresh 12-hex-digit request id."""
    return uuid4().hex[:12]


def _one_line(path: str) -> str:
    """The path with control and non-ASCII characters escaped, so it can't break the log line.

    The server hands over the path already percent-decoded: "%0A" in a URL arrives as a real
    newline, which would otherwise let a client write a line of its own into the log.
    """
    return path.encode("unicode_escape").decode("ascii")


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
                _one_line(scope["path"]),
                status_code,
                (time.perf_counter() - started) * 1000,
                request_id,
            )


class BodyLimitMiddleware:
    """Refuses a request body larger than `max_bytes`, so one request can't tie up the only worker.

    A declared Content-Length over the limit is refused before anything is read. A body sent without
    one (chunked) is counted while the app reads it and cut off at the limit. Either way the client
    gets the same 422 problem. It sits inside RequestIdMiddleware, whose request id the problem carries.
    """

    def __init__(self, app: ASGIApp, *, max_bytes: int = MAX_BODY_BYTES) -> None:
        self.app = app
        self.max_bytes = max_bytes

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        declared = Headers(scope=scope).get("content-length", "")
        if declared.isdigit() and int(declared) > self.max_bytes:
            response = problem_response(
                BodyTooLarge(), instance=Request(scope).url.path, request_id=scope["state"]["request_id"]
            )
            await response(scope, receive, send)
            return
        received = 0

        async def receive_within_limit() -> Message:
            nonlocal received
            message = await receive()
            received += len(message.get("body", b""))
            if received > self.max_bytes:
                # FastAPI lets an HTTPException raised while it reads the body through, and the
                # problem handlers turn a 413 into the same problem as above.
                raise HTTPException(status_code=413)
            return message

        await self.app(scope, receive_within_limit, send)
