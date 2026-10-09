/*
 * Whether the learner just pressed something: a dialog uses it to tell whether it opened in answer to them or on
 * its own (on page load, or when data arrived).
 */

/** How long a press keeps counting as the cause of whatever opens next. */
const RECENT_MS = 1000;

/** Presses only: a click opens things on pointerup, Enter and Esc on keydown. */
const PRESS_EVENTS = ["keydown", "pointerdown", "pointerup"] as const;

export interface InputRecency {
  /** True within a second of the last press. */
  recent(): boolean;
}

/** Starts watching `target` for key and pointer presses. */
export function watchInput(target: EventTarget, now: () => number = () => performance.now()): InputRecency {
  let lastPressAt = Number.NEGATIVE_INFINITY;
  const note = () => {
    lastPressAt = now();
  };
  // Capture phase, so a handler that stops propagation cannot hide a press.
  for (const type of PRESS_EVENTS) target.addEventListener(type, note, { capture: true, passive: true });
  return { recent: () => now() - lastPressAt < RECENT_MS };
}

// Watching from the moment the app's code loads catches the press that opens the very first dialog.
const pageInput = typeof window === "undefined" ? null : watchInput(window);

/** True within a second of the learner's last key or pointer press anywhere on the page. */
export function hasRecentInput(): boolean {
  return pageInput?.recent() ?? false;
}
