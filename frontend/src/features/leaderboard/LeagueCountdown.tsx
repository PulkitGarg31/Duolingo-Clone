"use client";

import { ClockIcon } from "@/components/icons/ClockIcon";
import type { ISODateTime } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatCountdown } from "@/lib/format";
import { useCountdown } from "@/lib/time/serverClock";
import { countdownTone, type CountdownTone } from "./leagueCopy";

/** Gold while days remain, orange on the last day, red in the last hour. */
const TONE_CLASSES: Record<CountdownTone, string> = {
  days: "text-bee",
  hours: "text-fox",
  minutes: "text-(--duo-fire-ant)",
};

interface LeagueCountdownProps {
  endsAt: ISODateTime;
  /** Called once when the week ends, so the finished week can be fetched. */
  onEnd?: () => void;
}

/** Time left in the league week, on the server's clock: "6 days", "14 hours", "45 minutes". */
export function LeagueCountdown({ endsAt, onEnd }: LeagueCountdownProps) {
  const msLeft = useCountdown(endsAt, onEnd);
  return (
    <p
      className={cn(
        "mt-1 mb-4 flex h-[26px] items-center justify-center gap-[5px] text-body font-extrabold",
        TONE_CLASSES[countdownTone(msLeft)],
      )}
    >
      <ClockIcon size={16} />
      <span>
        <span className="sr-only">Week ends in </span>
        {formatCountdown(msLeft)}
      </span>
    </p>
  );
}
