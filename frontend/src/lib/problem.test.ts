import { afterEach, describe, expect, it, vi } from "vitest";
import { API_BASE_URL, apiFetch } from "@/lib/api/client";
import { ApiError, isApiError, isRetryable } from "@/lib/api/errors";
import { bootWatch, wakeGate } from "@/lib/api/serverStatus";
import {
  actionErrorMessage,
  createQueryClient,
  onUnhandledActionError,
  type ActionErrorNotice,
} from "@/lib/queries/queryClient";
import { serverClock } from "@/lib/time/serverClock";

const outOfHearts = {
  type: "/problems/out-of-hearts",
  title: "Out of hearts",
  status: 409,
  detail: "You have no hearts left. Refill your hearts or practice to earn one.",
  instance: "/api/v1/sessions/14/items/103/answer",
  code: "OUT_OF_HEARTS",
  requestId: "6f1c2a9e4b7d",
  errors: [],
  nextHeartAt: "2026-10-08T16:00:00Z",
};

const validationProblem = {
  type: "/problems/validation-error",
  title: "Validation error",
  status: 422,
  detail: "The request is invalid.",
  instance: "/api/v1/me/settings",
  code: "VALIDATION_ERROR",
  requestId: "a1b2c3d4e5f6",
  errors: [{ field: "body.dailyGoalXp", message: "Input should be 10, 20, 30 or 50", kind: "literal_error" }],
};

function problemResponse(body: { status: number }, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status: body.status,
    headers: { "Content-Type": "application/problem+json", ...headers },
  });
}

function htmlResponse(status: number): Response {
  return new Response("<html><body><h1>502 Bad Gateway</h1></body></html>", {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function httpError(status: number): ApiError {
  return new ApiError({ status, code: "HTTP_ERROR", title: `HTTP ${status}`, detail: "" });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("ApiError.fromResponse", () => {
  it("parses a problem+json body, extension members included", async () => {
    const error = await ApiError.fromResponse(problemResponse(outOfHearts));

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(409);
    expect(error.code).toBe("OUT_OF_HEARTS");
    expect(error.title).toBe("Out of hearts");
    expect(error.detail).toBe(outOfHearts.detail);
    expect(error.message).toBe(outOfHearts.detail);
    expect(error.requestId).toBe("6f1c2a9e4b7d");
    expect(error.errors).toEqual([]);
    expect(error.problem?.nextHeartAt).toBe("2026-10-08T16:00:00Z");
  });

  it("keeps the field errors of a validation problem", async () => {
    const error = await ApiError.fromResponse(problemResponse(validationProblem));

    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.errors).toEqual(validationProblem.errors);
  });

  it("turns a non-JSON 502 page (a proxy waking the server) into a retryable HTTP_ERROR", async () => {
    const error = await ApiError.fromResponse(htmlResponse(502));

    expect(error.code).toBe("HTTP_ERROR");
    expect(error.status).toBe(502);
    expect(error.problem).toBeNull();
    expect(isRetryable(error)).toBe(true);
  });

  it("turns a JSON body that is not a problem into HTTP_ERROR", async () => {
    const response = new Response(JSON.stringify({ message: "upstream failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
    const error = await ApiError.fromResponse(response);

    expect(error.code).toBe("HTTP_ERROR");
    expect(error.status).toBe(500);
    expect(isRetryable(error)).toBe(false);
  });

  it("falls back to the X-Request-ID header when the body carries no request id", async () => {
    const response = new Response("Internal Server Error", {
      status: 500,
      headers: { "Content-Type": "text/plain", "X-Request-ID": "0123456789ab" },
    });

    expect((await ApiError.fromResponse(response)).requestId).toBe("0123456789ab");
  });
});

describe("ApiError.network", () => {
  it("turns a failed fetch into NETWORK_ERROR with status 0", () => {
    const error = ApiError.network(new TypeError("Failed to fetch"));

    expect(error.code).toBe("NETWORK_ERROR");
    expect(error.status).toBe(0);
    expect(error.requestId).toBeNull();
    expect(error.cause).toBeInstanceOf(TypeError);
    expect(isRetryable(error)).toBe(true);
  });

  it("reports a timeout as a NETWORK_ERROR too", () => {
    const error = ApiError.network(new DOMException("The operation was aborted.", "AbortError"));

    expect(error.code).toBe("NETWORK_ERROR");
    expect(error.title).toBe("Request timed out");
  });
});

describe("isRetryable and isApiError", () => {
  it.each([
    ["a network failure", ApiError.network(new TypeError("Failed to fetch")), true],
    ["HTTP 502", httpError(502), true],
    ["HTTP 503", httpError(503), true],
    ["HTTP 504", httpError(504), true],
    ["HTTP 500", httpError(500), false],
    ["a domain conflict", new ApiError({ status: 409, code: "OUT_OF_HEARTS", title: "", detail: "" }), false],
    ["a plain Error", new Error("boom"), false],
  ])("%s → %s", (_label, error, expected) => {
    expect(isRetryable(error)).toBe(expected);
  });

  it("narrows by code", () => {
    const error = new ApiError({ status: 409, code: "INSUFFICIENT_GEMS", title: "", detail: "" });

    expect(isApiError(error)).toBe(true);
    expect(isApiError(error, "INSUFFICIENT_GEMS")).toBe(true);
    expect(isApiError(error, "OUT_OF_HEARTS")).toBe(false);
    expect(isApiError(new Error("boom"))).toBe(false);
  });
});

describe("apiFetch", () => {
  it("sends JSON with the idempotency key and returns the parsed body", async () => {
    const fetchMock = vi.fn(async () => Response.json({ id: 7, replayed: false }, { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    const body = await apiFetch<{ id: number }>("/me/purchases", {
      json: { itemCode: "heart_refill" },
      idempotencyKey: "8f2d7c1e-0000-4000-8000-000000000001",
    });

    expect(body).toEqual({ id: 7, replayed: false });
    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE_URL}/me/purchases`,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ itemCode: "heart_refill" }),
        cache: "no-store",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "Idempotency-Key": "8f2d7c1e-0000-4000-8000-000000000001",
        },
      }),
    );
  });

  it("uses GET without a body unless told otherwise", async () => {
    const fetchMock = vi.fn(async () => Response.json({}));
    vi.stubGlobal("fetch", fetchMock);

    await apiFetch("/me");
    await apiFetch("/sessions/14/quit", { method: "POST" });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      `${API_BASE_URL}/me`,
      expect.objectContaining({ method: "GET", body: undefined, headers: { Accept: "application/json" } }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(2, `${API_BASE_URL}/sessions/14/quit`, expect.objectContaining({ method: "POST" }));
  });

  it("feeds every response, errors included, to the server clock and the restart watch", async () => {
    const clock = vi.spyOn(serverClock, "observe");
    const boot = vi.spyOn(bootWatch, "observe");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => problemResponse(outOfHearts, { "X-Server-Time": "2026-10-08T12:00:00Z", "X-Boot-Id": "boot-a" })),
    );

    await expect(apiFetch("/sessions/14/items/103/answer", { method: "PUT", json: { type: "skip" } })).rejects.toThrow();

    expect(clock).toHaveBeenCalledWith("2026-10-08T12:00:00Z");
    expect(boot).toHaveBeenCalledWith("boot-a");
  });

  it("throws a problem as an ApiError and leaves the wake gate alone", async () => {
    const rearm = vi.spyOn(wakeGate, "rearm");
    vi.stubGlobal("fetch", vi.fn(async () => problemResponse(outOfHearts)));

    const error = await apiFetch("/sessions/14/complete", { method: "POST" }).catch((e: unknown) => e);

    expect(isApiError(error, "OUT_OF_HEARTS")).toBe(true);
    expect(rearm).not.toHaveBeenCalled();
  });

  it("throws NETWORK_ERROR when fetch fails, and re-arms the wake gate", async () => {
    const rearm = vi.spyOn(wakeGate, "rearm");
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("Failed to fetch"))));

    const error = await apiFetch("/me").catch((e: unknown) => e);

    expect(isApiError(error, "NETWORK_ERROR")).toBe(true);
    expect(rearm).toHaveBeenCalledTimes(1);
  });

  it("re-arms the wake gate on a 503 while the server boots", async () => {
    const rearm = vi.spyOn(wakeGate, "rearm");
    vi.stubGlobal("fetch", vi.fn(async () => htmlResponse(503)));

    await expect(apiFetch("/me")).rejects.toBeInstanceOf(ApiError);
    expect(rearm).toHaveBeenCalledTimes(1);
  });

  it("gives up after the timeout with NETWORK_ERROR", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
          }),
      ),
    );

    const error = await apiFetch("/health", { timeoutMs: 20 }).catch((e: unknown) => e);

    expect(isApiError(error, "NETWORK_ERROR")).toBe(true);
    expect((error as ApiError).title).toBe("Request timed out");
  });
});

describe("query client error policy", () => {
  type Retry = (failureCount: number, error: unknown) => boolean;
  const defaults = createQueryClient().getDefaultOptions();
  const queryRetry = defaults.queries?.retry as Retry;
  const mutationRetry = defaults.mutations?.retry as Retry;
  const retryDelay = defaults.queries?.retryDelay as (attempt: number) => number;
  const offline = ApiError.network(new TypeError("Failed to fetch"));
  const conflict = new ApiError({ status: 409, code: "NODE_LOCKED", title: "", detail: "" });

  it("retries queries only for retryable errors, at most 6 times", () => {
    expect(queryRetry(0, offline)).toBe(true);
    expect(queryRetry(5, offline)).toBe(true);
    expect(queryRetry(6, offline)).toBe(false);
    expect(queryRetry(0, conflict)).toBe(false);
    expect(queryRetry(0, httpError(500))).toBe(false);
  });

  it("retries mutations only for retryable errors, at most 3 times", () => {
    expect(mutationRetry(2, offline)).toBe(true);
    expect(mutationRetry(3, offline)).toBe(false);
    expect(mutationRetry(0, conflict)).toBe(false);
  });

  it("backs off exponentially, capped at 10 seconds", () => {
    expect([0, 1, 2, 3, 4, 5].map(retryDelay)).toEqual([1_000, 2_000, 4_000, 8_000, 10_000, 10_000]);
  });

  it("explains transport failures and server bugs, and leaves domain errors to the feature", () => {
    expect(actionErrorMessage(offline)).toBe("Couldn't reach the server. Try again.");
    expect(actionErrorMessage(new ApiError({ status: 500, code: "INTERNAL_ERROR", title: "", detail: "" }))).toBe(
      "Something went wrong",
    );
    expect(actionErrorMessage(new Error("bug"))).toBe("Something went wrong");
    expect(actionErrorMessage(conflict)).toBeNull();
  });

  it("reports each action that fails for good, with its request id, and stays quiet about domain errors", async () => {
    const client = createQueryClient();
    const notices: ActionErrorNotice[] = [];
    onUnhandledActionError(client, (notice) => notices.push(notice));
    const fail = (error: ApiError) =>
      client
        .getMutationCache()
        .build(client, { mutationFn: () => Promise.reject(error), retry: 0 })
        .execute(undefined)
        .catch(() => undefined);

    await fail(offline);
    await fail(conflict);
    await fail(new ApiError({ status: 500, code: "INTERNAL_ERROR", title: "", detail: "", requestId: "abc123abc123" }));

    expect(notices).toEqual([
      { message: "Couldn't reach the server. Try again.", requestId: null },
      { message: "Something went wrong", requestId: "abc123abc123" },
    ]);
  });
});
