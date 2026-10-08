import type { ErrorCode, FieldError, ProblemDetails } from "./types";

/**
 * Every failure the client can see. Besides the server's stable codes there are two client-side ones:
 * `HTTP_ERROR` for a response that is not problem+json (Render's HTML 502 page while the server wakes up) and
 * `NETWORK_ERROR` for a request that never got an answer (offline, CORS-blocked, or timed out).
 */
export type ApiErrorCode = ErrorCode | "HTTP_ERROR" | "NETWORK_ERROR";

interface ApiErrorInit {
  status: number;
  code: ApiErrorCode;
  title: string;
  detail: string;
  requestId?: string | null;
  errors?: FieldError[];
  problem?: ProblemDetails | null;
  cause?: unknown;
}

/** Gateway answers Render gives while an instance is starting: worth retrying, never a server bug. */
const WAKING_STATUSES = new Set([502, 503, 504]);

export class ApiError extends Error {
  /** HTTP status, or 0 when no response arrived. */
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly title: string;
  readonly detail: string;
  /** The server's request id (body or `X-Request-ID`), shown in error chips to match server logs. */
  readonly requestId: string | null;
  /** Field-level messages; non-empty only for `VALIDATION_ERROR`. */
  readonly errors: FieldError[];
  /** The full problem body, including extension members such as `nextHeartAt` or `requiredGems`. */
  readonly problem: ProblemDetails | null;

  constructor(init: ApiErrorInit) {
    super(init.detail || init.title, { cause: init.cause });
    this.name = "ApiError";
    this.status = init.status;
    this.code = init.code;
    this.title = init.title;
    this.detail = init.detail;
    this.requestId = init.requestId ?? null;
    this.errors = init.errors ?? [];
    this.problem = init.problem ?? null;
  }

  /** Builds the error for a non-2xx response, reading its `application/problem+json` body when there is one. */
  static async fromResponse(res: Response): Promise<ApiError> {
    const headerRequestId = res.headers.get("X-Request-ID");
    const body = await readJsonBody(res);
    if (isProblemDetails(body)) {
      return new ApiError({
        status: res.status,
        code: body.code,
        title: body.title,
        detail: body.detail,
        requestId: body.requestId || headerRequestId,
        errors: Array.isArray(body.errors) ? body.errors : [],
        problem: body,
      });
    }
    return new ApiError({
      status: res.status,
      code: "HTTP_ERROR",
      title: res.statusText || `HTTP ${res.status}`,
      detail: `The server answered with HTTP ${res.status}.`,
      requestId: headerRequestId,
    });
  }

  /** Builds the error for a request that got no response at all: a fetch failure or our own timeout. */
  static network(cause: unknown): ApiError {
    const timedOut = cause instanceof DOMException && cause.name === "AbortError";
    return new ApiError({
      status: 0,
      code: "NETWORK_ERROR",
      title: timedOut ? "Request timed out" : "Network error",
      detail: timedOut ? "The server took too long to answer." : "The server could not be reached.",
      cause,
    });
  }
}

/** True for an `ApiError`, optionally with a specific code: `isApiError(error, "OUT_OF_HEARTS")`. */
export function isApiError(error: unknown, code?: ApiErrorCode): error is ApiError {
  return error instanceof ApiError && (code === undefined || error.code === code);
}

/**
 * Whether repeating the request can help: no answer at all, or a gateway status while Render wakes the server.
 * Every other 4xx/5xx is final, so a server bug is never hammered with retries.
 */
export function isRetryable(error: unknown): boolean {
  return error instanceof ApiError && (error.code === "NETWORK_ERROR" || WAKING_STATUSES.has(error.status));
}

async function readJsonBody(res: Response): Promise<unknown> {
  if (!res.headers.get("Content-Type")?.includes("json")) return null;
  try {
    return JSON.parse(await res.text());
  } catch {
    return null;
  }
}

function isProblemDetails(body: unknown): body is ProblemDetails {
  if (typeof body !== "object" || body === null) return false;
  const candidate = body as Partial<ProblemDetails>;
  return typeof candidate.code === "string" && typeof candidate.status === "number" && typeof candidate.title === "string";
}
