"use client";

import { useEffect, useState } from "react";
import { useTheme } from "@/lib/theme/ThemeProvider";

/**
 * A screen's choreography. `times` are milliseconds after mount at which each cue fires; the hook returns how
 * many have fired, so `cue >= 2` reads "the second beat has happened". With reduced motion every cue has
 * fired from the start, so the screen shows its final state at once. Pass a module-level array: a new array
 * on every render would restart the timers.
 */
export function useCues(times: readonly number[]): number {
  const { reducedMotion } = useTheme();
  const [fired, setFired] = useState(0);

  useEffect(() => {
    if (reducedMotion) return;
    const timers = times.map((at, index) =>
      window.setTimeout(() => setFired((count) => Math.max(count, index + 1)), at),
    );
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [times, reducedMotion]);

  return reducedMotion ? times.length : fired;
}
