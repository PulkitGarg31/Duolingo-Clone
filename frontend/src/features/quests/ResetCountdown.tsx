"use client";

import { ClockIcon } from "@/components/icons/ClockIcon";
import type { ISODateTime } from "@/lib/api/types";
import { formatCountdown } from "@/lib/format";
import { useCountdown } from "@/lib/time/serverClock";

interface ResetCountdownProps {
  resetsAt: ISODateTime;
  /** Called once when the day rolls over, so the new day's quests can be fetched. */
  onReset?: () => void;
}

/** Time until today's quests reset at local midnight, on the server's clock: an orange "12 HOURS". */
export function ResetCountdown({ resetsAt, onReset }: ResetCountdownProps) {
  const msLeft = useCountdown(resetsAt, onReset);
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 text-label text-fox uppercase">
      <ClockIcon size={20} />
      <span>
        <span className="sr-only">Resets in </span>
        {formatCountdown(msLeft)}
      </span>
    </span>
  );
}
