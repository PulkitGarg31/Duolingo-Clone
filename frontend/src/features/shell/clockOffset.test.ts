import { describe, expect, it } from "vitest";
import { formatClockOffset } from "./clockOffset";

const HOUR = 3600;
const DAY = 24 * HOUR;

describe("formatClockOffset", () => {
  it("shows days and hours", () => {
    expect(formatClockOffset(DAY + 5 * HOUR)).toBe("+1d 5h");
    expect(formatClockOffset(7 * DAY)).toBe("+7d");
  });

  it("shows hours and minutes under a day", () => {
    expect(formatClockOffset(5 * HOUR)).toBe("+5h");
    expect(formatClockOffset(2 * HOUR + 30 * 60)).toBe("+2h 30m");
  });

  it("shows minutes under an hour, rounding down", () => {
    expect(formatClockOffset(30 * 60 + 59)).toBe("+30m");
    expect(formatClockOffset(20)).toBe("+0m");
  });
});
