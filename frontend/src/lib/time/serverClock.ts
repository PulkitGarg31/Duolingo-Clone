import { useEffect, useEffectEvent, useState } from "react";
import type { ISODateTime } from "@/lib/api/types";

const LAST_MINUTE_MS = 60_000;

let skew = 0;

/**
 * Game time is the server's, never the device's: the demo tools move the server clock forward and a device
 * clock can simply be wrong. Every response's `X-Server-Time` header refreshes the offset between the two.
 */
export const serverClock = {
  /** Records the offset from an `X-Server-Time` header; a missing or unreadable header changes nothing. */
  observe(header: string | null, receivedAtMs: number = Date.now()): void {
    if (!header) return;
    const serverMs = Date.parse(header);
    if (!Number.isNaN(serverMs)) skew = serverMs - receivedAtMs;
  },

  /** Server time minus device time, in milliseconds. */
  skewMs(): number {
    return skew;
  },
};

/** The server's current instant, in epoch milliseconds. */
export function serverNow(): number {
  return Date.now() + skew;
}

/** Milliseconds from `nowMs` until `targetIso`, never negative; 0 when there is no usable target. */
export function remainingMs(targetIso: ISODateTime | null | undefined, nowMs: number): number {
  const target = targetIso ? Date.parse(targetIso) : Number.NaN;
  return Number.isNaN(target) ? 0 : Math.max(0, target - nowMs);
}

/** Delay before a countdown re-renders: every second, every 250 ms in the last minute, never past the target. */
export function tickDelayMs(remaining: number): number {
  return Math.min(remaining < LAST_MINUTE_MS ? 250 : 1_000, remaining);
}

/**
 * Milliseconds left until `targetIso` on the server clock, re-rendering while it runs down. `onExpire` fires once
 * per target when the countdown reaches 0: the hearts countdown uses it to refetch `me` so the server can
 * regenerate the heart, and the timed-practice clock uses it to end the run.
 */
export function useCountdown(targetIso: ISODateTime | null | undefined, onExpire?: () => void): number {
  const [now, setNow] = useState(serverNow);
  const expire = useEffectEvent(() => onExpire?.());

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const at = serverNow();
      setNow(at);
      const left = remainingMs(targetIso, at);
      if (left > 0) timer = setTimeout(tick, tickDelayMs(left));
      else if (targetIso) expire();
    };
    // The first tick re-reads the clock right away, so a new target never renders against an old "now" for long.
    timer = setTimeout(tick, 0);
    return () => clearTimeout(timer);
  }, [targetIso]);

  return remainingMs(targetIso, now);
}
