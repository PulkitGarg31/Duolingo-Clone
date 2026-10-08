"use client";

import type { ISODateTime } from "@/lib/api/types";
import { formatCountdown } from "@/lib/format";
import { useCountdown } from "@/lib/time/serverClock";

/**
 * "Next heart in 4 hours", counting down on the server clock, with the time in bold red. Inline, so it can sit
 * inside any paragraph.
 */
export function NextHeartIn({ at }: { at: ISODateTime }) {
  const remaining = useCountdown(at);
  return (
    <span>
      Next heart in <span className="font-extrabold text-heart">{formatCountdown(remaining)}</span>
    </span>
  );
}
