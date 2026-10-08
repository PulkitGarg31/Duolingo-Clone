import { describe, expect, it } from "vitest";
import { bubbleNodeIndex, nodeAriaLabel, nodeGlyph, nodeRingProgress } from "./nodePresentation";
import { makeNode } from "./testNodes";

describe("bubbleNodeIndex", () => {
  const completed = makeNode({ state: "completed" });
  const active = makeNode({ state: "active" });
  const chestToOpen = makeNode({ kind: "chest", state: "available" });
  const locked = makeNode({ state: "locked" });

  it("puts the bubble on the current node", () => {
    expect(bubbleNodeIndex([completed, active, locked])).toBe(1);
  });

  it("prefers the current node over a chest waiting to be opened", () => {
    expect(bubbleNodeIndex([completed, chestToOpen, active])).toBe(2);
  });

  it("falls back to a reachable chest when the unit has no current node", () => {
    expect(bubbleNodeIndex([completed, chestToOpen, completed])).toBe(1);
  });

  it("has no bubble in a unit with nothing to play", () => {
    expect(bubbleNodeIndex([completed, locked])).toBeNull();
  });
});

describe("nodeGlyph", () => {
  it("draws a skill as lock, star or check by state, and gold nodes with a star", () => {
    expect(nodeGlyph(makeNode({ state: "locked" }))).toBe("lock");
    expect(nodeGlyph(makeNode({ state: "active" }))).toBe("star");
    expect(nodeGlyph(makeNode({ state: "completed" }))).toBe("check");
    expect(nodeGlyph(makeNode({ state: "legendary" }))).toBe("star");
  });

  it("draws a unit review as a trophy in every state", () => {
    for (const state of ["locked", "active", "completed"] as const) {
      expect(nodeGlyph(makeNode({ kind: "review", state }))).toBe("trophy");
    }
  });
});

describe("nodeAriaLabel", () => {
  it("names the lesson, the skill and the state", () => {
    const active = makeNode({ state: "active", title: "Introduce yourself", nextLessonNumber: 2, lessonsCompleted: 1 });
    expect(nodeAriaLabel(active)).toBe("Lesson 2 of 3, Introduce yourself, current");
    expect(nodeAriaLabel(makeNode({ state: "completed", title: "Food" }))).toBe("Food, completed");
    expect(nodeAriaLabel(makeNode({ state: "legendary", title: "Say hello" }))).toBe("Say hello, legendary");
    expect(nodeAriaLabel(makeNode({ title: "Family" }))).toBe("Family, locked");
  });

  it("names a review without lesson numbers", () => {
    const review = makeNode({ kind: "review", state: "active", title: "Unit 2 review", lessonCount: 1 });
    expect(nodeAriaLabel(review)).toBe("Unit 2 review, current");
  });

  it("asks to open a reachable chest and names other chests plainly", () => {
    expect(nodeAriaLabel(makeNode({ kind: "chest", state: "available" }))).toBe("Open chest");
    expect(nodeAriaLabel(makeNode({ kind: "chest", state: "locked" }))).toBe("Chest, locked");
    expect(nodeAriaLabel(makeNode({ kind: "chest", state: "completed" }))).toBe("Chest, opened");
  });
});

describe("nodeRingProgress", () => {
  it("is the share of the skill's lessons completed", () => {
    expect(nodeRingProgress(makeNode({ lessonsCompleted: 1, lessonCount: 3 }))).toBeCloseTo(1 / 3);
    expect(nodeRingProgress(makeNode({ lessonsCompleted: 0, lessonCount: 3 }))).toBe(0);
  });

  it("is 0 for nodes without lessons", () => {
    expect(nodeRingProgress(makeNode({ kind: "chest", lessonsCompleted: 0, lessonCount: 0 }))).toBe(0);
  });
});
