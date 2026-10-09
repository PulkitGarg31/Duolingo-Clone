import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { tokenStore } from "@/lib/auth/tokenStore";
import { API_BASE_URL, apiFetch } from "./client";
import { login, logout, signup, startDemo } from "./endpoints";
import { isApiError } from "./errors";

function problem(status: number, code: string): Response {
  return new Response(
    JSON.stringify({
      type: `/problems/${code.toLowerCase()}`,
      title: code,
      status,
      detail: "",
      instance: "/api/v1/me",
      code,
      requestId: "0123456789ab",
      errors: [],
    }),
    { status, headers: { "Content-Type": "application/problem+json" } },
  );
}

/** Stubs fetch with the given answers in turn and returns the headers each request carried. */
function serve(...responses: Response[]): Record<string, string>[] {
  const sent: Record<string, string>[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: RequestInit) => {
      sent.push(init.headers as Record<string, string>);
      return responses.shift() ?? Response.json({});
    }),
  );
  return sent;
}

beforeEach(() => {
  tokenStore.clear();
});

afterEach(() => {
  tokenStore.clear();
  vi.unstubAllGlobals();
});

describe("apiFetch and the session token", () => {
  it("sends no Authorization header for the demo learner", async () => {
    const sent = serve(Response.json({}));

    await apiFetch("/me");

    expect(sent[0]).toEqual({ Accept: "application/json" });
  });

  it("sends the stored token as a bearer token", async () => {
    tokenStore.set("tok-1");
    const sent = serve(Response.json({}));

    await apiFetch("/me");

    expect(sent[0].Authorization).toBe("Bearer tok-1");
  });

  it("drops the token on 401 UNAUTHENTICATED and tells the app once, however many requests fail", async () => {
    tokenStore.set("tok-1");
    const signedOut = vi.fn();
    const unsubscribe = tokenStore.onExpire(signedOut);
    serve(problem(401, "UNAUTHENTICATED"), problem(401, "UNAUTHENTICATED"));

    const errors = await Promise.all([apiFetch("/me").catch((e: unknown) => e), apiFetch("/me/path").catch((e: unknown) => e)]);
    unsubscribe();

    expect(errors.every((error) => isApiError(error, "UNAUTHENTICATED"))).toBe(true);
    expect(tokenStore.get()).toBeNull();
    expect(signedOut).toHaveBeenCalledTimes(1);
  });

  it("keeps a token that replaced the refused one while the request was in flight", async () => {
    tokenStore.set("tok-old");
    let answer!: (response: Response) => void;
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((resolve) => (answer = resolve))));
    const signedOut = vi.fn();
    const unsubscribe = tokenStore.onExpire(signedOut);

    const pending = apiFetch("/me").catch((e: unknown) => e);
    tokenStore.set("tok-new");
    answer(problem(401, "UNAUTHENTICATED"));
    await pending;
    unsubscribe();

    expect(tokenStore.get()).toBe("tok-new");
    expect(signedOut).not.toHaveBeenCalled();
  });

  it("leaves the token alone for other refusals", async () => {
    tokenStore.set("tok-1");
    serve(problem(409, "OUT_OF_HEARTS"), problem(422, "VALIDATION_ERROR"));

    await apiFetch("/sessions", { json: {} }).catch(() => undefined);
    await apiFetch("/me/settings", { method: "PATCH", json: {} }).catch(() => undefined);

    expect(tokenStore.get()).toBe("tok-1");
  });
});

describe("auth endpoints", () => {
  it("log in and sign up without the stored token, so a stale one cannot sign the visitor out", async () => {
    tokenStore.set("tok-stale");
    const signedOut = vi.fn();
    const unsubscribe = tokenStore.onExpire(signedOut);
    const sent = serve(problem(401, "INVALID_CREDENTIALS"), Response.json({ token: "tok-2" }, { status: 201 }));

    const error = await login({ email: "ana@example.com", password: "wrong-password" }).catch((e: unknown) => e);
    await signup({ displayName: "Ana", email: "ana@example.com", password: "s3cret-pass" });
    unsubscribe();

    expect(isApiError(error, "INVALID_CREDENTIALS")).toBe(true);
    expect(sent.map((headers) => headers.Authorization)).toEqual([undefined, undefined]);
    expect(tokenStore.get()).toBe("tok-stale");
    expect(signedOut).not.toHaveBeenCalled();
  });

  it("log out names the token it ends", async () => {
    const fetchMock = vi.fn(async () => Response.json({ loggedOut: true }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(logout("tok-ending")).resolves.toEqual({ loggedOut: true });

    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE_URL}/auth/logout`,
      expect.objectContaining({ method: "POST", headers: { Accept: "application/json", Authorization: "Bearer tok-ending" } }),
    );
  });

  it("starting a demo sends the device's zone, and no token, so it can never act as a previous learner", async () => {
    tokenStore.set("tok-stale", "guest");
    const sent: [string, RequestInit][] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        sent.push([url, init]);
        return Response.json({ token: "tok-guest" }, { status: 201 });
      }),
    );

    await startDemo("Europe/Madrid");
    await startDemo(null);

    expect(sent.map(([url, init]) => [url, init.method, init.body])).toEqual([
      [`${API_BASE_URL}/auth/demo`, "POST", JSON.stringify({ timezone: "Europe/Madrid" })],
      [`${API_BASE_URL}/auth/demo`, "POST", "{}"],
    ]);
    expect(sent.map(([, init]) => (init.headers as Record<string, string>).Authorization)).toEqual([undefined, undefined]);
  });
});
