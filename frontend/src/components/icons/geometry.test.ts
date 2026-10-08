import { describe, expect, it } from "vitest";
import { arcPath, polygonPath, raysPath, regularPolygon, roundedPolygon, shieldPath, starPoints } from "./geometry";

function expectPoints(actual: readonly (readonly [number, number])[], expected: [number, number][]) {
  expect(actual).toHaveLength(expected.length);
  actual.forEach(([x, y], i) => {
    expect(x).toBeCloseTo(expected[i][0], 6);
    expect(y).toBeCloseTo(expected[i][1], 6);
  });
}

describe("regularPolygon", () => {
  it("places the first corner at the top by default and walks clockwise", () => {
    expectPoints(regularPolygon(0, 0, 1, 4), [
      [0, -1],
      [1, 0],
      [0, 1],
      [-1, 0],
    ]);
  });

  it("honours the centre, the radius and a custom start angle", () => {
    expectPoints(regularPolygon(10, 20, 2, 4, 0), [
      [12, 20],
      [10, 22],
      [8, 20],
      [10, 18],
    ]);
  });
});

describe("starPoints", () => {
  it("alternates tips on the outer radius with notches on the inner radius, tip first at the top", () => {
    const points = starPoints(0, 0, 2, 1);
    expect(points).toHaveLength(10);
    expectPoints(points.slice(0, 2), [
      [0, -2],
      [Math.cos((-54 * Math.PI) / 180), Math.sin((-54 * Math.PI) / 180)],
    ]);
  });

  it("supports other point counts", () => {
    expect(starPoints(0, 0, 2, 1, 4)).toHaveLength(8);
  });
});

describe("roundedPolygon", () => {
  const square: [number, number][] = [
    [0, 0],
    [10, 0],
    [10, 10],
    [0, 10],
  ];

  it("cuts every corner back along both edges and bridges it with a curve through the corner", () => {
    expect(roundedPolygon(square, 2)).toBe("M2 0L8 0Q10 0 10 2L10 8Q10 10 8 10L2 10Q0 10 0 8L0 2Q0 0 2 0Z");
  });

  it("never cuts past the middle of an edge", () => {
    expect(roundedPolygon(square, 99)).toBe(roundedPolygon(square, 5));
  });

  it("accepts one cut per corner", () => {
    expect(roundedPolygon(square, [0, 2, 0, 2])).toBe(
      "M0 0L8 0Q10 0 10 2L10 10Q10 10 10 10L2 10Q0 10 0 8L0 0Q0 0 0 0Z",
    );
  });

  it("repeats a shorter list of cuts round the corners", () => {
    expect(roundedPolygon(square, [0, 2])).toBe(roundedPolygon(square, [0, 2, 0, 2]));
  });

  it("rounds coordinates to two decimals", () => {
    const triangle: [number, number][] = [
      [0, 0],
      [3, 0],
      [0, 3],
    ];
    expect(roundedPolygon(triangle, 1 / 3)).toBe(
      "M0.33 0L2.67 0Q3 0 2.76 0.24L0.24 2.76Q0 3 0 2.67L0 0.33Q0 0 0.33 0Z",
    );
  });
});

describe("raysPath", () => {
  it("draws one spoke per ray from the inner to the outer radius, the first pointing up", () => {
    expect(raysPath(0, 0, 1, 2, 4)).toBe("M0 -1L0 -2M1 0L2 0M0 1L0 2M-1 0L-2 0");
  });
});

describe("arcPath", () => {
  it("draws a clockwise arc between two angles", () => {
    expect(arcPath(0, 0, 1, 0, 90)).toBe("M1 0A1 1 0 0 1 0 1");
  });

  it("sets the large-arc flag for sweeps over 180 degrees", () => {
    expect(arcPath(0, 0, 2, -90, 180)).toBe("M0 -2A2 2 0 1 1 -2 0");
  });
});

describe("shieldPath", () => {
  it("draws a flat top with round corners, straight sides and a round bottom 60% as deep as it is wide", () => {
    expect(shieldPath(0, 0, 10, 20, 2)).toBe(
      "M2 0H8A2 2 0 0 1 10 2V14C10 17.3 7.75 20 5 20C2.25 20 0 17.3 0 14V2A2 2 0 0 1 2 0Z",
    );
  });
});

describe("polygonPath", () => {
  it("joins the corners with straight lines and closes the shape", () => {
    expect(polygonPath([[0, 0], [1 / 3, 0], [0, 2]])).toBe("M0 0L0.33 0L0 2Z");
  });
});
