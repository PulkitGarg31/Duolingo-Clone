import { tokenStore } from "@/lib/auth/tokenStore";
import { serverClock } from "@/lib/time/serverClock";
import { ApiError, isApiError, isRetryable } from "./errors";
import { bootWatch, wakeGate } from "./serverStatus";

/** The API root, e.g. https://owlingo-api.onrender.com/api/v1. Defaults to the local backend. */
export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api/v1").replace(/\/+$/, "");

const DEFAULT_TIMEOUT_MS = 15_000;

export interface ApiFetchOptions {
  /** Defaults to GET, or POST when `json` is given. */
  method?: "GET" | "POST" | "PUT" | "PATCH";
  /** Request body, sent as JSON. */
  json?: unknown;
  /** Sent as the `Idempotency-Key` header (purchases). */
  idempotencyKey?: string;
  /**
   * The session token to send instead of the stored one (logout names the token it ends). Null sends none,
   * which makes the request as the demo learner.
   */
  token?: string | null;
  timeoutMs?: number;
}

/**
 * The only function that talks to the API. It resolves with the parsed JSON body and rejects with an `ApiError`.
 * A signed-in learner's token goes out as `Authorization: Bearer …`; without one the server answers as the demo
 * learner. Every response feeds the server clock and the restart watch; a failure that suggests the server fell
 * asleep re-arms the wake gate, and an UNAUTHENTICATED answer drops the token it was sent with.
 */
export async function apiFetch<T>(path: string, opts: ApiFetchOptions = {}): Promise<T> {
  // Read when the call starts, so the 401 below drops exactly the token this request carried.
  const token = opts.token === undefined ? tokenStore.get() : opts.token;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      method: opts.method ?? (opts.json === undefined ? "GET" : "POST"),
      headers: {
        Accept: "application/json",
        ...(token && { Authorization: `Bearer ${token}` }),
        ...(opts.json !== undefined && { "Content-Type": "application/json" }),
        ...(opts.idempotencyKey && { "Idempotency-Key": opts.idempotencyKey }),
      },
      body: opts.json === undefined ? undefined : JSON.stringify(opts.json),
      signal: controller.signal,
      cache: "no-store",
    });
    serverClock.observe(res.headers.get("X-Server-Time"));
    bootWatch.observe(res.headers.get("X-Boot-Id"));
    if (!res.ok) throw await ApiError.fromResponse(res);
    return (await res.json()) as T;
  } catch (e) {
    const error = e instanceof ApiError ? e : ApiError.network(e);
    if (isRetryable(error)) wakeGate.rearm();
    // The session expired or was revoked (a server restart wipes every account): the app signs out.
    if (token && isApiError(error, "UNAUTHENTICATED")) tokenStore.expire(token);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
