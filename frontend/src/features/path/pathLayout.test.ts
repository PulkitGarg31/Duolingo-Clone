import { describe, expect, it } from "vitest";
import { decorAnchors, nodeMarginTop, nodeOffsetX, unitNodeLayout } from "./pathLayout";

const round = (value: number) => Math.round(value * 10) / 10;

describe("nodeOffsetX", () => {
  it("swings the first unit left first: 0, −45, −70, −45, 0, +45, +70, +45", () => {
    const offsets = Array.from({ length: 8 }, (_, i) => round(nodeOffsetX(i, 0, false)));
    expect(offsets).toEqual([0, -44.9, -70, -44.9, 0, 44.9, 70, 44.9]);
  });

  it("repeats every 8 nodes", () => {
    for (let i = 0; i < 8; i++) expect(nodeOffsetX(i + 8, 0, false)).toBe(nodeOffsetX(i, 0, false));
  });

  it("swings odd units right first, mirroring even ones", () => {
    for (let i = 0; i < 8; i++) expect(round(nodeOffsetX(i, 1, false))).toBe(round(-nodeOffsetX(i, 0, false)) || 0);
    expect(nodeOffsetX(2, 3, false)).toBe(70);
    expect(nodeOffsetX(2, 2, false)).toBe(-70);
  });

  it("centres a unit's last node", () => {
    expect(nodeOffsetX(2, 0, true)).toBe(0);
    expect(nodeOffsetX(6, 1, true)).toBe(0);
  });
});

describe("nodeMarginTop", () => {
  it("leaves 24 px above a unit's first node, plus room for a START bubble", () => {
    expect(nodeMarginTop(0, 0, true, false)).toBe(24);
    expect(nodeMarginTop(0, 0, true, true)).toBe(67);
  });

  it("keeps every node centre 89 px from the previous one", () => {
    expect(round(nodeMarginTop(0, -44.884, false, false))).toBe(11.9);
    expect(round(nodeMarginTop(-44.884, -70, false, false))).toBe(20.4);
    expect(nodeMarginTop(0, 0, false, false)).toBe(24);
  });

  it("ignores the bubble on later nodes, which floats over the gap", () => {
    expect(nodeMarginTop(0, 0, false, true)).toBe(24);
  });
});

describe("unitNodeLayout", () => {
  it("lays out a unit's nodes with offsets and margins", () => {
    const layout = unitNodeLayout(4, 0, null).map(({ x, marginTop }) => [round(x), round(marginTop)]);
    expect(layout).toEqual([
      [0, 24],
      [-44.9, 11.9],
      [-70, 20.4],
      [0, -10],
    ]);
  });

  it("makes room above the first node only when it carries the bubble", () => {
    expect(unitNodeLayout(3, 1, 0)[0].marginTop).toBe(67);
    expect(unitNodeLayout(3, 1, 1)[0].marginTop).toBe(24);
  });
});

describe("decorAnchors", () => {
  it("places the mascot beside the third node, opposite the first swing", () => {
    expect(decorAnchors(4, 0)).toEqual([{ nodeIndex: 2, side: "right" }]);
    expect(decorAnchors(4, 1)).toEqual([{ nodeIndex: 2, side: "left" }]);
  });

  it("falls back to the last node of a short unit", () => {
    expect(decorAnchors(2, 0)).toEqual([{ nodeIndex: 1, side: "right" }]);
    expect(decorAnchors(0, 0)).toEqual([]);
  });

  it("adds a second mascot on the other side of long units", () => {
    expect(decorAnchors(9, 0)).toEqual([
      { nodeIndex: 2, side: "right" },
      { nodeIndex: 6, side: "left" },
    ]);
  });
});
