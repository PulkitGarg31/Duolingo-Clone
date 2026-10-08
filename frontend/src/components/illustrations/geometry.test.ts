import { describe, expect, it } from "vitest";
import { circlePath, roundedPolygon } from "./geometry";

describe("circlePath", () => {
  it("draws two half-circle arcs from the leftmost point", () => {
    expect(circlePath(10, 20, 5)).toBe("M5 20a5 5 0 1 0 10 0a5 5 0 1 0 -10 0Z");
  });
});

describe("roundedPolygon", () => {
  const square = [
    [0, 0],
    [100, 0],
    [100, 100],
    [0, 100],
  ] as const;

  it("rounds every corner of a square with a quadratic curve through the corner", () => {
    expect(roundedPolygon(square, 10)).toBe(
      "M10 0L90 0Q100 0 100 10L100 90Q100 100 90 100L10 100Q0 100 0 90L0 10Q0 0 10 0Z",
    );
  });

  it("keeps sharp corners when the radius is zero", () => {
    expect(roundedPolygon(square, 0)).toBe("M0 0L100 0Q100 0 100 0L100 100Q100 100 100 100L0 100Q0 100 0 100L0 0Q0 0 0 0Z");
  });

  it("takes one radius per corner", () => {
    expect(roundedPolygon(square, [0, 20, 0, 20])).toBe(
      "M0 0L80 0Q100 0 100 20L100 100Q100 100 100 100L20 100Q0 100 0 80L0 0Q0 0 0 0Z",
    );
  });

  it("caps a radius at half of the shorter neighbouring edge", () => {
    const strip = [
      [0, 0],
      [20, 0],
      [20, 100],
      [0, 100],
    ] as const;
    // 50 is more than half of the 20-unit edges, so every corner rounds by 10.
    expect(roundedPolygon(strip, 50)).toBe("M10 0L10 0Q20 0 20 10L20 90Q20 100 10 100L10 100Q0 100 0 90L0 10Q0 0 10 0Z");
  });

  it("rounds a triangle's corners along its slanted edges", () => {
    const d = roundedPolygon(
      [
        [0, 0],
        [40, 0],
        [0, 30],
      ],
      5,
    );
    // The 3-4-5 hypotenuse makes the offsets along it exact: 5 units is (4, -3) from (40, 0) towards (0, 30).
    expect(d).toBe("M5 0L35 0Q40 0 36 3L4 27Q0 30 0 25L0 5Q0 0 5 0Z");
  });
});
