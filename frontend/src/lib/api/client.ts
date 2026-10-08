import { serverClock } from "@/lib/time/serverClock";
import { ApiError, isRetryable } from "./errors";
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
  timeoutMs?: number;
}

/**
 * The only function that talks to the API. It resolves with the parsed JSON body and rejects with an `ApiError`.
 * Every response feeds the server clock and the restart watch; a failure that suggests the server fell asleep
 * re-arms the wake gate.
 */
export async function apiFetch<T>(path: string, opts: ApiFetchOptions = {}): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      method: opts.method ?? (opts.json === undefined ? "GET" : "POST"),
      headers: {
        Accept: "application/json",
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
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
