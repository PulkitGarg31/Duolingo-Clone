import { describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/errors";
import type { AuthOut } from "@/lib/api/types";
import { createGuestSession } from "./guestSession";
import { createTokenStore } from "./tokenStore";

function guestAuth(token: string, timezone: string | null = "Europe/Madrid"): AuthOut {
  return {
    token,
    expiresAt: "2026-11-07T12:00:00Z",
    user: {
      id: 40,
      username: "guest_3f9a1c07be",
      displayName: "Alex",
      avatarColor: "#1CB0F6",
      timezone: timezone ?? "Asia/Kolkata",
      timezoneConfirmed: timezone !== null,
      joinedAt: "2026-09-08T06:30:00Z",
      email: null,
      isDemo: true,
    },
  };
}

function problem(status: number, code: "VALIDATION_ERROR" | "INTERNAL_ERROR"): ApiError {
  return new ApiError({ status, code, title: code, detail: "" });
}

/** A guest session over an in-memory token store, with the demo endpoint and the device zone stubbed. */
function setup(timeZone: string | null = "Europe/Madrid") {
  const store = createTokenStore(() => null);
  let answered = 0;
  const startDemo = vi.fn(async (timezone: string | null) => guestAuth(`tok-guest-${++answered}`, timezone));
  const session = createGuestSession({ store, startDemo, timeZone: () => timeZone });
  return { store, startDemo, session };
}

describe("starting a private demo", () => {
  it("starts a guest in the device's zone and keeps its token as a guest token", async () => {
    const { store, startDemo, session } = setup();

    await session.ensure();

    expect(startDemo).toHaveBeenCalledExactlyOnceWith("Europe/Madrid");
    expect([store.get(), store.kind()]).toEqual(["tok-guest-1", "guest"]);
  });

  it("sends one request however many callers ask while it runs (StrictMode's double effects)", async () => {
    const { store, startDemo, session } = setup();

    await Promise.all([session.ensure(), session.ensure(), session.ensure()]);
    await session.ensure();

    expect(startDemo).toHaveBeenCalledTimes(1);
    expect(store.get()).toBe("tok-guest-1");
  });

  it("does nothing when the tab already has a learner", async () => {
    const { store, startDemo, session } = setup();
    store.set("tok-ana", "account");

    await session.ensure();

    expect(startDemo).not.toHaveBeenCalled();
    expect([store.get(), store.kind()]).toEqual(["tok-ana", "account"]);
  });

  it("starts without a zone when the browser cannot tell one", async () => {
    const { startDemo, session } = setup(null);

    await session.ensure();

    expect(startDemo).toHaveBeenCalledExactlyOnceWith(null);
  });

  it("starts again without the zone when the server does not know it", async () => {
    const { store, startDemo, session } = setup("Etc/Unknown");
    startDemo.mockRejectedValueOnce(problem(422, "VALIDATION_ERROR"));

    await session.ensure();

    expect(startDemo.mock.calls).toEqual([["Etc/Unknown"], [null]]);
    expect(store.kind()).toBe("guest");
  });

  it("rejects a failed attempt and lets the next call try again", async () => {
    const { store, startDemo, session } = setup();
    startDemo.mockRejectedValueOnce(problem(500, "INTERNAL_ERROR"));

    await expect(session.ensure()).rejects.toMatchObject({ code: "INTERNAL_ERROR" });
    expect(store.get()).toBeNull();

    await session.ensure();
    expect(startDemo).toHaveBeenCalledTimes(2);
    expect(store.get()).toBe("tok-guest-1");
  });

  it("keeps an account signed in while the demo request was out", async () => {
    const { store, startDemo, session } = setup();
    let answer!: (auth: AuthOut) => void;
    startDemo.mockImplementationOnce(() => new Promise<AuthOut>((resolve) => (answer = resolve)));

    const pending = session.ensure();
    store.set("tok-ana", "account");
    answer(guestAuth("tok-late-guest"));
    await pending;

    expect([store.get(), store.kind()]).toEqual(["tok-ana", "account"]);
  });
});
