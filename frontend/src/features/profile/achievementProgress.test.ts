import { describe, expect, it } from "vitest";
import type { AchievementOut } from "@/lib/api/types";
import { achievementProgress } from "./achievementProgress";

function achievement(overrides: Partial<AchievementOut>): AchievementOut {
  return {
    code: "wildfire",
    name: "Wildfire",
    color: "#FF9600",
    level: 2,
    maxLevel: 10,
    currentValue: 13,
    nextThreshold: 14,
    description: "Reach a 14 day streak",
    tiers: [
      { level: 1, threshold: 3, unlockedAt: "2026-10-08T11:58:43Z" },
      { level: 2, threshold: 7, unlockedAt: "2026-10-08T11:58:43Z" },
      { level: 3, threshold: 14, unlockedAt: null },
    ],
    ...overrides,
  };
}

describe("achievementProgress", () => {
  it("counts towards the next level", () => {
    expect(achievementProgress(achievement({}))).toEqual({ value: 13 / 14, counter: "13/14", maxed: false });
  });

  it("starts empty when nothing is earned yet", () => {
    const sharpshooter = achievement({ level: 0, maxLevel: 5, currentValue: 0, nextThreshold: 1, tiers: [] });
    expect(achievementProgress(sharpshooter)).toEqual({ value: 0, counter: "0/1", maxed: false });
  });

  it("fills up at the top level and caps the count at the last threshold", () => {
    const winner = achievement({
      code: "winner",
      level: 1,
      maxLevel: 1,
      currentValue: 3,
      nextThreshold: null,
      tiers: [{ level: 1, threshold: 1, unlockedAt: "2026-10-05T00:00:05Z" }],
    });
    expect(achievementProgress(winner)).toEqual({ value: 1, counter: "1/1", maxed: true });
  });

  it("never prints a thousands separator", () => {
    const sage = achievement({ code: "sage", currentValue: 1525, nextThreshold: 2000 });
    expect(achievementProgress(sage).counter).toBe("1525/2000");
  });
});
