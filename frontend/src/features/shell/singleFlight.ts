import { useState } from "react";

/** Starts an action and receives `done`, to call once it has finished (succeeded or failed). */
type Start = (done: () => void) => void;

/**
 * Lets one action run at a time: `run(start)` returns false, and does nothing, while an earlier start has not
 * called its `done`. Each `done` frees only its own run, so a late call cannot release a newer one.
 */
export function createSingleFlight(): (start: Start) => boolean {
  let current: object | null = null;
  return function run(start: Start): boolean {
    if (current !== null) return false;
    const token = {};
    current = token;
    const done = () => {
      if (current === token) current = null;
    };
    try {
      start(done);
    } catch (error) {
      done();
      throw error;
    }
    return true;
  };
}

/**
 * A single-flight guard for click handlers that start a mutation. Both clicks of a double click land before
 * React re-renders with the mutation's pending state, so that state cannot stop the second click; this can.
 */
export function useSingleFlight(): (start: Start) => boolean {
  const [run] = useState(createSingleFlight);
  return run;
}
