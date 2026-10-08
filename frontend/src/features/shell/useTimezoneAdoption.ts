import { useEffect, useRef } from "react";
import type { MeUser } from "@/lib/api/types";
import { useUpdateSettings } from "@/lib/queries/mutations";

/** Remembers, for this tab, the zone already sent, so a failure is not retried on every page. */
const ATTEMPT_STORAGE_KEY = "timezoneAdoption";

/**
 * Adopts the device's time zone on the learner's first visit (`timezoneConfirmed` is false): one settings
 * PATCH, in the background, with no loading gate. The server shifts the streak calendar to the new zone and the
 * settings mutation refreshes every query when it reports "shifted". A rejected zone (some privacy-hardened
 * browsers report "Etc/Unknown") simply leaves the learner in the seed zone. Later changes are Settings' job.
 */
export function useTimezoneAdoption(user: MeUser | undefined): void {
  const { mutate } = useUpdateSettings();
  const attempted = useRef(false);

  useEffect(() => {
    if (!user || user.timezoneConfirmed || attempted.current) return;
    attempted.current = true;
    const timezone = deviceTimeZone();
    if (!timezone || alreadyAttempted(timezone)) return;
    rememberAttempt(timezone);
    mutate({ timezone });
  }, [user, mutate]);
}

function deviceTimeZone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

function alreadyAttempted(timezone: string): boolean {
  try {
    return window.sessionStorage.getItem(ATTEMPT_STORAGE_KEY) === timezone;
  } catch {
    return false;
  }
}

function rememberAttempt(timezone: string): void {
  try {
    window.sessionStorage.setItem(ATTEMPT_STORAGE_KEY, timezone);
  } catch {
    // Storage blocked: the in-memory guard still prevents a second attempt while this tab is open.
  }
}
