"use client";

import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { ServerReadyContext, useServerReady } from "@/lib/api/serverStatus";
import { guestSession } from "@/lib/auth/guestSession";
import { tokenStore } from "@/lib/auth/tokenStore";

/** Pause before starting a demo again after a failure that did not send the server back to sleep. */
const RETRY_DELAY_MS = 3_000;

function hasToken(): boolean {
  return tokenStore.get() !== null;
}

/**
 * Gives a visitor without a token a private demo before any page asks for data. Once the wake gate reports the
 * server ready, it starts a guest (POST /auth/demo, in the device's time zone) and stores its token as a guest
 * token. Until the tab has a token it reports "not ready" below it, so every query hook stays disabled and the
 * pages keep their wake screen and skeletons. One request per tab: repeated effects (StrictMode) and a refused
 * token's recovery share it. A failed attempt is tried again: an unreachable server re-arms the wake gate, which
 * runs the effect again once it answers, and any other failure waits a few seconds.
 */
export function GuestSessionGate({ children }: { children: ReactNode }) {
  const serverReady = useServerReady();
  const signedIn = useSyncExternalStore(tokenStore.subscribe, hasToken, () => false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!serverReady || signedIn) return;
    let active = true;
    let retry: ReturnType<typeof setTimeout> | undefined;
    guestSession.ensure().catch(() => {
      if (active) retry = setTimeout(() => setAttempt((count) => count + 1), RETRY_DELAY_MS);
    });
    return () => {
      active = false;
      clearTimeout(retry);
    };
  }, [serverReady, signedIn, attempt]);

  return <ServerReadyContext.Provider value={serverReady && signedIn}>{children}</ServerReadyContext.Provider>;
}
