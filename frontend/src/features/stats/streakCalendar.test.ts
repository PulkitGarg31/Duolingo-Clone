import { describe, expect, it } from "vitest";
import type { ActivityDayOut, DayState } from "@/lib/api/types";
import { buildMonthGrid, monthFetchRange, monthOf, shiftMonth, type CalendarDay } from "./streakCalendar";

const OCTOBER = { year: 2026, month: 10 };

function day(date: string, state: DayState): ActivityDayOut {
  return { date, xp: state === "active" ? 15 : 0, goalXp: state === "active" ? 20 : null, goalMet: false, state };
}

/** The October cell for a day of the month. */
function cell(grid: (CalendarDay | null)[][], dayOfMonth: number): CalendarDay {
  const found = grid.flat().find((entry) => entry?.day === dayOfMonth);
  if (!found) throw new Error(`no cell for ${dayOfMonth}`);
  return found;
}

describe("month helpers", () => {
  it("reads the month of a learner-local date", () => {
    expect(monthOf("2026-10-08")).toEqual(OCTOBER);
  });

  it("steps across year boundaries", () => {
    expect(shiftMonth({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
    expect(shiftMonth({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
  });

  it("fetches from the day before the 1st up to today or the month's end", () => {
    expect(monthFetchRange(OCTOBER, "2026-10-08")).toEqual({ from: "2026-09-30", to: "2026-10-08" });
    expect(monthFetchRange({ year: 2026, month: 9 }, "2026-10-08")).toEqual({ from: "2026-08-31", to: "2026-09-30" });
  });
});

describe("buildMonthGrid", () => {
  it("lays the month out in Sunday-first weeks", () => {
    const grid = buildMonthGrid(OCTOBER, [], "2026-10-08");
    expect(grid).toHaveLength(5);
    expect(grid[0].map((entry) => entry?.day ?? null)).toEqual([null, null, null, null, 1, 2, 3]);
    expect(grid[4].map((entry) => entry?.day ?? null)).toEqual([25, 26, 27, 28, 29, 30, 31]);
  });

  it("marks run starts, frozen days and an extended today", () => {
    const days = [
      day("2026-09-30", "active"),
      day("2026-10-01", "active"),
      day("2026-10-02", "frozen"),
      day("2026-10-03", "active"),
      day("2026-10-04", "none"),
      day("2026-10-05", "active"),
      day("2026-10-06", "active"),
      day("2026-10-07", "none"),
      day("2026-10-08", "active"),
    ];
    const grid = buildMonthGrid(OCTOBER, days, "2026-10-08");
    // October 1 continues a run that began in September, so it is not a start.
    expect(cell(grid, 1).mark).toBe("streak");
    expect(cell(grid, 2).mark).toBe("frozen");
    expect(cell(grid, 4).mark).toBe("none");
    expect(cell(grid, 5).mark).toBe("start");
    expect(cell(grid, 6).mark).toBe("streak");
    expect(cell(grid, 8)).toMatchObject({ mark: "today", isToday: true });
  });

  it("leaves today unmarked until the streak is extended", () => {
    const grid = buildMonthGrid(OCTOBER, [day("2026-10-07", "active"), day("2026-10-08", "none")], "2026-10-08");
    expect(cell(grid, 8)).toMatchObject({ mark: "none", isToday: true });
  });

  it("joins streak days with a band inside a week row only", () => {
    const days = ["01", "02", "03", "04", "05"].map((dd) => day(`2026-10-${dd}`, "active"));
    const grid = buildMonthGrid(OCTOBER, days, "2026-10-08");
    expect(cell(grid, 1)).toMatchObject({ joinsPrevious: false, joinsNext: true });
    expect(cell(grid, 2)).toMatchObject({ joinsPrevious: true, joinsNext: true });
    // Saturday the 3rd ends the row, Sunday the 4th starts the next one.
    expect(cell(grid, 3)).toMatchObject({ joinsPrevious: true, joinsNext: false });
    expect(cell(grid, 4)).toMatchObject({ joinsPrevious: false, joinsNext: true });
    expect(cell(grid, 5)).toMatchObject({ joinsPrevious: true, joinsNext: false });
  });

  it("flags days after today as future", () => {
    const grid = buildMonthGrid(OCTOBER, [], "2026-10-08");
    expect(cell(grid, 8).isFuture).toBe(false);
    expect(cell(grid, 9).isFuture).toBe(true);
  });
});
