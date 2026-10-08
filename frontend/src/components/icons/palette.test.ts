import { describe, expect, it } from "vitest";
import { shade } from "./palette";

describe("shade", () => {
  it("scales each channel, so 0.8 gives the palette's lip colours", () => {
    expect(shade("#FF9600", 0.8)).toBe("#CC7800");
    expect(shade("#58CC02", 0.8)).toBe("#46A302");
    expect(shade("#CE82FF", 0.8)).toBe("#A568CC");
  });

  it("rounds each channel and keeps two hex digits", () => {
    expect(shade("#0A0A0A", 0.5)).toBe("#050505");
    expect(shade("#010101", 0.5)).toBe("#010101");
  });
});
