import { describe, expect, it } from "vitest";
import type { ActivityDayOut, DayState } from "@/lib/api/types";
import { addDays, buildWeek } from "./weekChart";

function day(date: string, state: DayState, xp = 0, goalMet = false): ActivityDayOut {
  return { date, xp, goalXp: state === "active" ? 20 : null, goalMet, state };
}

describe("addDays", () => {
  it("moves across month and year ends", () => {
    expect(addDays("2026-10-01", -1)).toBe("2026-09-30");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-10-08", -6)).toBe("2026-10-02");
  });
});

describe("buildWeek", () => {
  const days = [
    day("2026-10-02", "frozen"),
    day("2026-10-03", "active", 43, true),
    day("2026-10-04", "active", 15),
    day("2026-10-05", "active", 14),
    day("2026-10-06", "active", 15),
    day("2026-10-07", "active", 13),
    day("2026-10-08", "none"),
  ];

  it("scales bars to the larger of the best day and the goal", () => {
    const week = buildWeek(days, "2026-10-08", 20);
    expect(week.max).toBe(43);
    expect(week.goalRatio).toBeCloseTo(20 / 43);
    expect(week.bars.map((bar) => bar.ratio)).toEqual([0, 1, 15 / 43, 14 / 43, 15 / 43, 13 / 43, 0]);
    expect(week.total).toBe(100);
  });

  it("labels each bar with its weekday initial and flags today and met goals", () => {
    const week = buildWeek(days, "2026-10-08", 20);
    expect(week.bars.map((bar) => bar.initial).join("")).toBe("FSSMTWT");
    expect(week.bars.map((bar) => bar.isToday)).toEqual([false, false, false, false, false, false, true]);
    expect(week.bars.map((bar) => bar.goalMet)).toEqual([false, true, false, false, false, false, false]);
  });

  it("counts a day missing from the activity as 0 XP", () => {
    const week = buildWeek(days.slice(2), "2026-10-08", 20);
    expect(week.bars.map((bar) => bar.xp)).toEqual([0, 0, 15, 14, 15, 13, 0]);
  });

  it("keeps a goal-high scale for an empty week", () => {
    const week = buildWeek([], "2026-10-08", 30);
    expect(week.max).toBe(30);
    expect(week.goalRatio).toBe(1);
    expect(week.total).toBe(0);
  });
});
