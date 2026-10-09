import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/lib/api/client";
import type { AuthOut } from "@/lib/api/types";
import { createGuestSession } from "./guestSession";
import { DEMO_RESTARTED_MESSAGE, SIGNED_OUT_MESSAGE, recoverFromRefusedToken, type ExpiryActions } from "./sessionExpiry";
import { tokenStore, type TokenKind } from "./tokenStore";

function fakeActions(startGuest: () => Promise<void> = async () => undefined) {
  const calls: string[] = [];
  const actions: ExpiryActions = {
    clearCache: vi.fn(() => void calls.push("clear cache")),
    startGuest: vi.fn(() => {
      calls.push("start guest");
      return startGuest();
    }),
    toast: vi.fn((message: string) => void calls.push(`toast: ${message}`)),
    goTo: vi.fn((href: string) => void calls.push(`go to ${href}`)),
  };
  return { actions, calls };
}

function unauthenticated(): Response {
  return new Response(
    JSON.stringify({
      type: "/problems/unauthenticated",
      title: "Unauthenticated",
      status: 401,
      detail: "",
      instance: "/api/v1/me",
      code: "UNAUTHENTICATED",
      requestId: "0123456789ab",
      errors: [],
    }),
    { status: 401, headers: { "Content-Type": "application/problem+json" } },
  );
}

afterEach(() => {
  tokenStore.clear();
  vi.unstubAllGlobals();
});

describe("recovering from a refused token", () => {
  it("replaces a lost guest with a new private demo, says so, and stays in the app", () => {
    const { actions, calls } = fakeActions();

    recoverFromRefusedToken("guest", actions);

    expect(calls).toEqual(["clear cache", "start guest", `toast: ${DEMO_RESTARTED_MESSAGE}`, "go to /learn"]);
    expect(DEMO_RESTARTED_MESSAGE).toBe("Your demo was restarted with fresh progress");
  });

  it("signs an account holder out to the welcome page, without starting a demo", () => {
    const { actions, calls } = fakeActions();

    recoverFromRefusedToken("account", actions);

    expect(calls).toEqual(["clear cache", `toast: ${SIGNED_OUT_MESSAGE}`, "go to /welcome"]);
    expect(actions.startGuest).not.toHaveBeenCalled();
  });

  it("leaves a failed restart of the demo to the guest gate, without an unhandled rejection", async () => {
    const { actions } = fakeActions(() => Promise.reject(new Error("still asleep")));

    recoverFromRefusedToken("guest", actions);
    await Promise.resolve();

    expect(actions.goTo).toHaveBeenCalledWith("/learn");
  });

  it("from a 401 on a guest token to a new guest token, end to end", async () => {
    tokenStore.set("tok-lost-guest", "guest");
    const startDemo = vi.fn(async (): Promise<AuthOut> => ({
      token: "tok-new-guest",
      expiresAt: "2026-11-07T12:00:00Z",
      user: {
        id: 41,
        username: "guest_0a1b2c3d4e",
        displayName: "Alex",
        avatarColor: "#1CB0F6",
        timezone: "UTC",
        timezoneConfirmed: true,
        joinedAt: "2026-09-08T06:30:00Z",
        email: null,
        isDemo: true,
      },
    }));
    const guests = createGuestSession({ store: tokenStore, startDemo, timeZone: () => "UTC" });
    const kinds: TokenKind[] = [];
    let started: Promise<void> = Promise.resolve();
    const { actions } = fakeActions(() => (started = guests.ensure()));
    const unsubscribe = tokenStore.onExpire((kind) => {
      kinds.push(kind);
      recoverFromRefusedToken(kind, actions);
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => unauthenticated()),
    );

    // The server restarted and rebuilt its database: two pages' requests are refused at once.
    await Promise.all([apiFetch("/me").catch(() => undefined), apiFetch("/me/path").catch(() => undefined)]);
    await started;
    unsubscribe();

    expect(kinds).toEqual(["guest"]); // recovered once
    expect(startDemo).toHaveBeenCalledExactlyOnceWith("UTC");
    expect([tokenStore.get(), tokenStore.kind()]).toEqual(["tok-new-guest", "guest"]);
    expect(actions.toast).toHaveBeenCalledExactlyOnceWith(DEMO_RESTARTED_MESSAGE);
    expect(actions.goTo).toHaveBeenCalledExactlyOnceWith("/learn");
  });

  it("an account's 401 drops its token and starts no demo", async () => {
    tokenStore.set("tok-ana", "account");
    const kinds: TokenKind[] = [];
    const unsubscribe = tokenStore.onExpire((kind) => void kinds.push(kind));
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => unauthenticated()),
    );

    await apiFetch("/me").catch(() => undefined);
    unsubscribe();

    expect(kinds).toEqual(["account"]);
    expect(tokenStore.get()).toBeNull();
  });
});
