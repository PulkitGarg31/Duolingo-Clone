import { describe, expect, it } from "vitest";
import { watchInput } from "./inputRecency";

function setup() {
  const clock = { now: 10_000 };
  const target = new EventTarget();
  const input = watchInput(target, () => clock.now);
  return { clock, target, input };
}

describe("watchInput", () => {
  it("is not recent before any press", () => {
    expect(setup().input.recent()).toBe(false);
  });

  it("counts a press as recent for one second", () => {
    const { clock, target, input } = setup();
    target.dispatchEvent(new Event("pointerdown"));
    clock.now += 999;
    expect(input.recent()).toBe(true);
    clock.now += 1;
    expect(input.recent()).toBe(false);
  });

  it("notices key presses and pointer releases as well", () => {
    for (const type of ["keydown", "pointerup"]) {
      const { clock, target, input } = setup();
      target.dispatchEvent(new Event(type));
      clock.now += 500;
      expect(input.recent()).toBe(true);
    }
  });

  it("ignores events that are not presses", () => {
    const { target, input } = setup();
    for (const type of ["pointermove", "scroll", "focus"]) target.dispatchEvent(new Event(type));
    expect(input.recent()).toBe(false);
  });
});
