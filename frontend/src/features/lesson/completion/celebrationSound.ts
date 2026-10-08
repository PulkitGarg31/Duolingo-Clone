"use client";

import { useEffect, useRef } from "react";
import { playSound, type SoundName } from "@/lib/sound";

/**
 * Plays a celebration sound. Until the page has had a tap or a key press the browser keeps audio locked, so a
 * screen shown straight after a reload stays silent instead of trying (and warning) on every count-up tick.
 */
export function playCelebrationSound(name: SoundName): void {
  if (typeof navigator !== "undefined" && navigator.userActivation?.hasBeenActive === false) return;
  playSound(name);
}

/**
 * Plays `name` the first time `when` is true while the component is mounted, so a sound lands on its visual
 * beat (the flame igniting, the chest opening) and never repeats on a re-render.
 */
export function useSoundOnce(name: SoundName, when = true): void {
  const played = useRef(false);
  useEffect(() => {
    if (!when || played.current) return;
    played.current = true;
    playCelebrationSound(name);
  }, [name, when]);
}
