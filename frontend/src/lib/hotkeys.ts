/*
 * The lesson's keyboard shortcuts as a pure function, so the rules are testable without a browser:
 *   Enter            CHECK, CONTINUE or the next celebration screen
 *   1–9, 0           option, tile or pair N (match pairs: left 1–5, right 6–0)
 *   Backspace        remove the last answer tile
 *   Ctrl+Space       replay the audio (Ctrl+Shift+Space: slowly)
 *   Esc              open the quit modal
 * Keys typed into a text field are the learner's answer, so only Enter (and Ctrl+Space) act there.
 */

export type HotkeyAction =
  | { type: "primary" }
  | { type: "choose"; index: number }
  | { type: "removeLast" }
  | { type: "replay"; slow: boolean }
  | { type: "quit" };

/**
 * What is on screen:
 * - `choices`: options to pick (multiple choice);
 * - `tiles`: a word bank or blank to fill, where Backspace takes the last tile back;
 * - `match`: match pairs;
 * - `typing`: a text answer;
 * - `continue`: the feedback bar or a coach slide;
 * - `celebration`: the screens after a lesson;
 * - `none`: nothing to act on (a request in flight, or a modal that owns the keyboard).
 */
export type HotkeyMode = "choices" | "tiles" | "match" | "typing" | "continue" | "celebration" | "none";

export interface HotkeyContext {
  mode: HotkeyMode;
  /** Focus is in a text field. */
  inTextField: boolean;
  /** Focus is on a button or link that is not an answer choice: Enter activates it natively. */
  onControl: boolean;
}

export interface KeyModifiers {
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
  meta: boolean;
}

const EXERCISE_MODES: ReadonlySet<HotkeyMode> = new Set(["choices", "tiles", "match", "typing"]);
const PICKING_MODES: ReadonlySet<HotkeyMode> = new Set(["choices", "tiles", "match"]);

/** The action for a key press, or null when the key is not a shortcut here. */
export function keyToAction(key: string, mods: KeyModifiers, context: HotkeyContext): HotkeyAction | null {
  const { mode, inTextField, onControl } = context;
  if (mode === "none") return null;

  // The replay shortcut works from the answer box too: listening exercises are answered while typing.
  if (key === " " && mods.ctrl && !mods.alt && !mods.meta) {
    return EXERCISE_MODES.has(mode) ? { type: "replay", slow: mods.shift } : null;
  }
  if (mods.ctrl || mods.alt || mods.meta) return null;

  if (key === "Enter") {
    if (mods.shift && inTextField) return null; // a new line in the answer
    return onControl ? null : { type: "primary" };
  }
  if (inTextField) return null;

  if (key === "Escape") return mode === "celebration" ? null : { type: "quit" };
  if (key === "Backspace") return mode === "tiles" ? { type: "removeLast" } : null;
  if (/^[0-9]$/.test(key) && PICKING_MODES.has(mode)) {
    const digit = Number(key);
    return { type: "choose", index: digit === 0 ? 9 : digit - 1 };
  }
  return null;
}
