import { describe, expect, it } from "vitest";
import { keyToAction, type HotkeyContext, type HotkeyMode, type KeyModifiers } from "./hotkeys";

const NO_MODS: KeyModifiers = { ctrl: false, shift: false, alt: false, meta: false };
const CTRL: KeyModifiers = { ...NO_MODS, ctrl: true };
const SHIFT: KeyModifiers = { ...NO_MODS, shift: true };

function ctx(mode: HotkeyMode, extra: Partial<HotkeyContext> = {}): HotkeyContext {
  return { mode, inTextField: false, onControl: false, ...extra };
}

describe("choices", () => {
  it("maps 1–9 to options 0–8 and 0 to the tenth", () => {
    expect(keyToAction("1", NO_MODS, ctx("choices"))).toEqual({ type: "choose", index: 0 });
    expect(keyToAction("3", NO_MODS, ctx("choices"))).toEqual({ type: "choose", index: 2 });
    expect(keyToAction("9", NO_MODS, ctx("choices"))).toEqual({ type: "choose", index: 8 });
    expect(keyToAction("0", NO_MODS, ctx("choices"))).toEqual({ type: "choose", index: 9 });
  });

  it("checks on Enter", () => {
    expect(keyToAction("Enter", NO_MODS, ctx("choices"))).toEqual({ type: "primary" });
  });

  it("has nothing to remove on Backspace", () => {
    expect(keyToAction("Backspace", NO_MODS, ctx("choices"))).toBeNull();
  });

  it("leaves digits with a modifier to the browser", () => {
    expect(keyToAction("1", CTRL, ctx("choices"))).toBeNull();
    expect(keyToAction("1", { ...NO_MODS, alt: true }, ctx("choices"))).toBeNull();
    expect(keyToAction("1", { ...NO_MODS, meta: true }, ctx("choices"))).toBeNull();
  });
});

describe("tiles", () => {
  it("picks bank tiles by number and removes the last answer tile on Backspace", () => {
    expect(keyToAction("2", NO_MODS, ctx("tiles"))).toEqual({ type: "choose", index: 1 });
    expect(keyToAction("Backspace", NO_MODS, ctx("tiles"))).toEqual({ type: "removeLast" });
  });

  it("checks on Enter", () => {
    expect(keyToAction("Enter", NO_MODS, ctx("tiles"))).toEqual({ type: "primary" });
  });
});

describe("match pairs", () => {
  it("numbers the left column 1–5 and the right column 6–0", () => {
    expect(keyToAction("5", NO_MODS, ctx("match"))).toEqual({ type: "choose", index: 4 });
    expect(keyToAction("6", NO_MODS, ctx("match"))).toEqual({ type: "choose", index: 5 });
    expect(keyToAction("0", NO_MODS, ctx("match"))).toEqual({ type: "choose", index: 9 });
  });
});

describe("typing", () => {
  const typing = ctx("typing", { inTextField: true });

  it("checks on Enter and leaves Shift+Enter for a new line", () => {
    expect(keyToAction("Enter", NO_MODS, typing)).toEqual({ type: "primary" });
    expect(keyToAction("Enter", SHIFT, typing)).toBeNull();
  });

  it("ignores digits, Backspace and Escape typed into the answer", () => {
    expect(keyToAction("1", NO_MODS, typing)).toBeNull();
    expect(keyToAction("Backspace", NO_MODS, typing)).toBeNull();
    expect(keyToAction("Escape", NO_MODS, typing)).toBeNull();
  });

  it("replays the audio with Ctrl+Space even from the answer box, slowly with Shift", () => {
    expect(keyToAction(" ", CTRL, typing)).toEqual({ type: "replay", slow: false });
    expect(keyToAction(" ", { ...CTRL, shift: true }, typing)).toEqual({ type: "replay", slow: true });
  });

  it("ignores a plain space", () => {
    expect(keyToAction(" ", NO_MODS, typing)).toBeNull();
  });
});

describe("feedback and coach slides", () => {
  it("continues on Enter and ignores exercise keys", () => {
    expect(keyToAction("Enter", NO_MODS, ctx("continue"))).toEqual({ type: "primary" });
    expect(keyToAction("1", NO_MODS, ctx("continue"))).toBeNull();
    expect(keyToAction("Backspace", NO_MODS, ctx("continue"))).toBeNull();
    expect(keyToAction(" ", CTRL, ctx("continue"))).toBeNull();
  });
});

describe("celebrations", () => {
  it("moves to the next screen on Enter and cannot be quit", () => {
    expect(keyToAction("Enter", NO_MODS, ctx("celebration"))).toEqual({ type: "primary" });
    expect(keyToAction("Escape", NO_MODS, ctx("celebration"))).toBeNull();
    expect(keyToAction("1", NO_MODS, ctx("celebration"))).toBeNull();
  });
});

describe("quitting", () => {
  it.each(["choices", "tiles", "match", "typing", "continue"] as const)("opens the quit modal on Escape in %s", (mode) => {
    expect(keyToAction("Escape", NO_MODS, ctx(mode))).toEqual({ type: "quit" });
  });
});

describe("focus and overlays", () => {
  it("lets a focused button or link handle Enter itself", () => {
    expect(keyToAction("Enter", NO_MODS, ctx("choices", { onControl: true }))).toBeNull();
    expect(keyToAction("Enter", NO_MODS, ctx("continue", { onControl: true }))).toBeNull();
  });

  it("still picks choices by number while a button has focus", () => {
    expect(keyToAction("2", NO_MODS, ctx("choices", { onControl: true }))).toEqual({ type: "choose", index: 1 });
  });

  it("does nothing while a modal owns the keyboard", () => {
    for (const key of ["Enter", "Escape", "1", "Backspace", " "]) {
      expect(keyToAction(key, key === " " ? CTRL : NO_MODS, ctx("none"))).toBeNull();
    }
  });

  it("ignores keys held with Ctrl, Alt or Meta, except Ctrl+Space", () => {
    expect(keyToAction("Enter", CTRL, ctx("choices"))).toBeNull();
    expect(keyToAction("Backspace", { ...NO_MODS, alt: true }, ctx("tiles"))).toBeNull();
    expect(keyToAction("Escape", { ...NO_MODS, meta: true }, ctx("choices"))).toBeNull();
  });

  it("ignores unrelated keys", () => {
    expect(keyToAction("a", NO_MODS, ctx("choices"))).toBeNull();
    expect(keyToAction("Tab", NO_MODS, ctx("choices"))).toBeNull();
    expect(keyToAction("ArrowLeft", NO_MODS, ctx("tiles"))).toBeNull();
  });
});
