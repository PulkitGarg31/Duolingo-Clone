import { startDemo } from "@/lib/api/endpoints";
import { isApiError } from "@/lib/api/errors";
import type { AuthOut } from "@/lib/api/types";
import { deviceTimeZoneOrNull } from "@/lib/time/deviceTimeZone";
import { tokenStore, type TokenStore } from "./tokenStore";

/*
 * A visitor without an account plays a guest: a private copy of the demo on the server (the sample learner's
 * history under a user of its own), so one visitor's lessons never show up for another. The app starts one
 * when an app page loads without a token (GuestSessionGate), and again when the server no longer knows the
 * guest (a restart rebuilt its database).
 */

export interface GuestSessionDeps {
  store: Pick<TokenStore, "get" | "set">;
  startDemo: (timezone: string | null) => Promise<AuthOut>;
  /** The device's IANA zone, or null when the browser cannot tell. */
  timeZone: () => string | null;
}

export function createGuestSession({ store, startDemo, timeZone }: GuestSessionDeps) {
  let pending: Promise<void> | null = null;

  async function start(): Promise<void> {
    const zone = timeZone();
    const auth = await startDemo(zone).catch((error: unknown) => {
      // Some privacy-hardened browsers report a zone the server does not know: start in the seed zone instead.
      if (zone && isApiError(error, "VALIDATION_ERROR")) return startDemo(null);
      throw error;
    });
    // A login or signup that landed meanwhile wins: that is the learner the visitor chose.
    if (store.get() === null) store.set(auth.token, "guest");
  }

  return {
    /**
     * Makes sure the tab has a learner: without a token, starts a private demo and stores its token as a guest
     * token. Calls made while one is starting (repeated effects, a refused token and the gate) share its single
     * request; a failed attempt rejects with its ApiError and leaves the way open for the next call.
     */
    ensure(): Promise<void> {
      if (store.get() !== null) return Promise.resolve();
      pending ??= start().finally(() => {
        pending = null;
      });
      return pending;
    },
  };
}

export type GuestSession = ReturnType<typeof createGuestSession>;

export const guestSession = createGuestSession({ store: tokenStore, startDemo, timeZone: deviceTimeZoneOrNull });
