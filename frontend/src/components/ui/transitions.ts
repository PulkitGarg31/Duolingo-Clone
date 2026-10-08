import { useReducedMotionConfig } from "motion/react";

/*
 * Timing shared by the primitives that animate with Motion. The curves are the --ease-* tokens of tokens.css as
 * cubic-bezier control points, the form Motion takes; keep both in sync when a curve changes.
 */

/** Pops: modals, toasts and badges overshoot slightly before they settle. */
export const EASE_SPRING = [0.34, 1.56, 0.64, 1] as const;

/** Entrances: sheets and popovers decelerate into place. */
export const EASE_OUT = [0, 0, 0.2, 1] as const;

/** Exits: elements accelerate away. */
export const EASE_IN = [0.4, 0, 1, 1] as const;

const REDUCED_FADE_SECONDS = 0.1;

/**
 * Returns a function that turns a fade duration into the one to use. When motion is reduced (Settings or the
 * OS) Motion already skips movement; fades stay, but last at most 100 ms.
 */
export function useFadeSeconds(): (seconds: number) => number {
  const reduced = useReducedMotionConfig();
  return (seconds) => (reduced ? Math.min(seconds, REDUCED_FADE_SECONDS) : seconds);
}
