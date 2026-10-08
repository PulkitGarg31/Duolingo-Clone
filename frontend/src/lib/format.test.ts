import { describe, expect, it } from "vitest";
import {
  formatClock,
  formatCountdown,
  formatMonthYear,
  formatNumber,
  formatPercent,
  formatShortDate,
  formatStreak,
  formatTotal,
  pluralize,
} from "./format";

const SECOND = 1_000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe("formatCountdown", () => {
  it.each([
    [6 * DAY + 23 * HOUR, "6 days"],
    [DAY, "1 day"],
    [DAY - 1, "23 hours"],
    [14 * HOUR + 59 * MINUTE, "14 hours"],
    [HOUR, "1 hour"],
    [HOUR - 1, "59 minutes"],
    [45 * MINUTE + 59 * SECOND, "45 minutes"],
    [MINUTE, "1 minute"],
    [MINUTE - 1, "59 seconds"],
    [30 * SECOND + 999, "30 seconds"],
    [SECOND, "1 second"],
    [999, "0 seconds"],
    [0, "0 seconds"],
    [-5 * SECOND, "0 seconds"],
  ])("%i ms reads %s (always rounded down)", (ms, expected) => {
    expect(formatCountdown(ms)).toBe(expected);
  });
});

describe("formatClock", () => {
  it.each([
    [102, "1:42"],
    [30, "0:30"],
    [0, "0:00"],
    [59.9, "0:59"],
    [600, "10:00"],
    [3725, "62:05"],
    [-3, "0:00"],
  ])("%d seconds reads %s", (seconds, expected) => {
    expect(formatClock(seconds)).toBe(expected);
  });
});

describe("totals and numbers", () => {
  it("never puts a thousands separator in XP and gem totals", () => {
    expect(formatTotal(1525)).toBe("1525");
    expect(formatTotal(1200)).toBe("1200");
    expect(formatTotal(1234567)).toBe("1234567");
    expect(formatTotal(0)).toBe("0");
  });

  it("groups every other number above 999", () => {
    expect(formatNumber(999)).toBe("999");
    expect(formatNumber(1525)).toBe("1,525");
    expect(formatNumber(1234567)).toBe("1,234,567");
  });

  it("rounds percentages half up", () => {
    expect(formatPercent(93)).toBe("93%");
    expect(formatPercent(92.5)).toBe("93%");
    expect(formatPercent(92.49)).toBe("92%");
    expect(formatPercent(100)).toBe("100%");
  });
});

describe("plurals", () => {
  it("pluralizes everywhere except the streak label", () => {
    expect(pluralize(1, "day")).toBe("1 day");
    expect(pluralize(2, "day")).toBe("2 days");
    expect(pluralize(0, "day")).toBe("0 days");
    expect(pluralize(3, "person", "people")).toBe("3 people");
  });

  it("keeps 'day' singular in the streak label", () => {
    expect(formatStreak(1)).toBe("1 day streak");
    expect(formatStreak(12)).toBe("12 day streak");
  });
});

describe("dates", () => {
  it("formats list dates as 'Oct 8'", () => {
    expect(formatShortDate("2026-10-08")).toBe("Oct 8");
    expect(formatShortDate("2026-01-01")).toBe("Jan 1");
  });

  it("formats calendar headers as 'October 2026'", () => {
    expect(formatMonthYear("2026-10-08")).toBe("October 2026");
  });

  it("reads an instant by its UTC calendar date, independent of the machine's zone", () => {
    expect(formatShortDate("2026-10-08T23:30:00Z")).toBe("Oct 8");
    expect(formatMonthYear("2025-03-01T00:15:00Z")).toBe("March 2025");
  });
});
