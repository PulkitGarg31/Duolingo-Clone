import { describe, expect, it } from "vitest";
import { countdownTone, promotionSubtitle, unlockMessage, unlockProgress } from "./leagueCopy";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe("promotionSubtitle", () => {
  it.each([
    [20, "Top 20 advance to the next league"],
    [7, "Top 7 advance to the next league"],
    [1, "First place advances to the next league"],
    [0, "You've reached the top league!"],
  ])("promoting %i reads %s", (promoteCount, expected) => {
    expect(promotionSubtitle(promoteCount)).toBe(expected);
  });
});

describe("countdownTone", () => {
  it.each([
    [6 * DAY, "days"],
    [DAY, "days"],
    [DAY - 1, "hours"],
    [HOUR, "hours"],
    [HOUR - 1, "minutes"],
    [0, "minutes"],
  ] as const)("%i ms left is %s", (msLeft, expected) => {
    expect(countdownTone(msLeft)).toBe(expected);
  });
});

describe("unlockMessage", () => {
  it("counts the lessons still needed", () => {
    expect(unlockMessage(6)).toBe("Complete 6 more lessons to start competing");
  });

  it("keeps a single lesson singular", () => {
    expect(unlockMessage(1)).toBe("Complete 1 more lesson to start competing");
  });
});

describe("unlockProgress", () => {
  it("turns the lessons left into lessons done out of ten", () => {
    expect(unlockProgress(6)).toEqual({ done: 4, total: 10 });
  });

  it("never goes below zero or above ten", () => {
    expect(unlockProgress(12)).toEqual({ done: 0, total: 10 });
    expect(unlockProgress(0)).toEqual({ done: 10, total: 10 });
  });
});
