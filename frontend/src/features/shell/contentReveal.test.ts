import { describe, expect, it } from "vitest";
import { createRevealWatch } from "./contentReveal";

describe("createRevealWatch", () => {
  it("reports the moment content replaces the skeleton", () => {
    const revealed = createRevealWatch(true);
    expect(revealed(true)).toBe(false);
    expect(revealed(false)).toBe(true);
  });

  it("reports nothing for content that renders without a skeleton", () => {
    const revealed = createRevealWatch(false);
    expect(revealed(false)).toBe(false);
    expect(revealed(false)).toBe(false);
  });

  it("reports each later skeleton-to-content swap once", () => {
    const revealed = createRevealWatch(false);
    expect(revealed(true)).toBe(false);
    expect(revealed(false)).toBe(true);
    expect(revealed(false)).toBe(false);
    expect(revealed(true)).toBe(false);
    expect(revealed(false)).toBe(true);
  });
});
