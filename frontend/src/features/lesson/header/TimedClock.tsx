"use client";

import { motion } from "motion/react";
import { ClockIcon } from "@/components/icons/ClockIcon";
import type { ISODateTime } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatClock } from "@/lib/format";
import { useCountdown } from "@/lib/time/serverClock";

/** Under this many seconds the clock turns red and pulses. */
const URGENT_SECONDS = 10;

/** Seconds a correct answer added, floating up from the clock. `key` identifies the answer. */
export interface TimeBonus {
  seconds: number;
  key: number;
}

interface TimedClockProps {
  /** The server's deadline; it moves later with every correct answer. */
  expiresAt: ISODateTime;
  onTimeUp(): void;
  bonus: TimeBonus | null;
}

/** Timed practice's clock in place of the hearts: purple, red and pulsing in the last 10 seconds. */
export function TimedClock({ expiresAt, onTimeUp, bonus }: TimedClockProps) {
  const seconds = Math.ceil(useCountdown(expiresAt, onTimeUp) / 1000);
  const urgent = seconds < URGENT_SECONDS;
  return (
    <div
      role="timer"
      aria-label={`${seconds} seconds left`}
      className={cn("relative flex shrink-0 items-center gap-2 text-stat tabular-nums", urgent ? "text-heart" : "text-beetle")}
    >
      <span className={cn("block", urgent && seconds > 0 && "animate-[last-heart_1s_ease-in-out_infinite]")}>
        <ClockIcon size={24} />
      </span>
      <span>{formatClock(seconds)}</span>
      {bonus && (
        <motion.span
          key={bonus.key}
          aria-hidden="true"
          initial={{ opacity: 1, y: 0 }}
          animate={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="pointer-events-none absolute right-0 bottom-full text-[15px] font-black text-beetle"
        >
          +{bonus.seconds}s
        </motion.span>
      )}
    </div>
  );
}
