import { useCallback, useState } from "react";

export interface ValueChange<T> {
  /** The value this one replaced, from the render where it changed until `settle()`; null before any change. */
  previous: T | null;
  /** How many times the value has changed. As a `key`, it remounts an element so a one-off animation replays. */
  count: number;
  /** Forgets the change once its animation has played. Stable across renders. */
  settle: () => void;
}

/**
 * Remembers what a value changed from, for animations that mark a change but must not play on first render:
 * a path node unlocking as the learner returns from a lesson, a quest chest opening, a stat number rolling.
 * Uses React's "store information from previous renders" pattern, so it needs no effect.
 */
export function useValueChange<T>(value: T): ValueChange<T> {
  const [current, setCurrent] = useState(value);
  const [previous, setPrevious] = useState<T | null>(null);
  const [count, setCount] = useState(0);
  const settle = useCallback(() => setPrevious(null), []);
  if (!Object.is(current, value)) {
    setCurrent(value);
    setPrevious(current);
    setCount(count + 1);
  }
  return { previous, count, settle };
}
