"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { cn } from "@/lib/cn";

/** Count-up ticks are sound effects; more than one every 40 ms turns into a buzz. */
const TICK_INTERVAL_MS = 40;

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

interface CountUpProps {
  /** The number to count to. Changing it counts on from the number on screen. */
  value: number;
  /** The first number shown. */
  from?: number;
  durationMs?: number;
  /** Holds the count until its container has landed (a stat card, a flame). */
  start?: boolean;
  /** Formats each frame, e.g. seconds as "1:42". */
  format?: (value: number) => string;
  /** Called as the number changes, at most every 40 ms, to play a tick. */
  onTick?: () => void;
  /** Called once the target is reached. */
  onDone?: () => void;
  className?: string;
}

/**
 * Counts from the number on screen to `value` with an ease-out curve. Digits are tabular so the width never
 * jitters. Screen readers get only the final value. With reduced motion the number jumps straight to it.
 */
export function CountUp({
  value,
  from = 0,
  durationMs = 800,
  start = true,
  format = String,
  onTick,
  onDone,
  className,
}: CountUpProps) {
  const [shown, setShown] = useState(from);
  // The same number as `shown`, readable when a new target arrives without restarting the effect.
  const shownRef = useRef(from);
  const tick = useEffectEvent(() => onTick?.());
  const done = useEffectEvent(() => onDone?.());

  useEffect(() => {
    if (!start) return;
    const startValue = shownRef.current;
    const instant = durationMs <= 0 || startValue === value || document.documentElement.dataset.motion === "reduced";
    let frame = 0;
    let startedAt: number | undefined;
    let lastTickAt = -Infinity;

    const step = (now: number) => {
      startedAt ??= now;
      const t = instant ? 1 : Math.min(1, (now - startedAt) / durationMs);
      const next = Math.round(startValue + (value - startValue) * easeOutCubic(t));
      if (next !== shownRef.current) {
        shownRef.current = next;
        setShown(next);
        if (now - lastTickAt >= TICK_INTERVAL_MS) {
          lastTickAt = now;
          tick();
        }
      }
      if (t < 1) frame = requestAnimationFrame(step);
      else done();
    };

    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value, start, durationMs]);

  return (
    <span className={cn("tabular-nums", className)}>
      <span aria-hidden="true">{format(shown)}</span>
      <span className="sr-only">{format(value)}</span>
    </span>
  );
}
