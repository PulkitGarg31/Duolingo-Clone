import type { ISODate, ISODateTime } from "@/lib/api/types";

const SECOND_MS = 1_000;
const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

const groupedNumber = new Intl.NumberFormat("en-US");
const shortDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const monthYear = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

/** "1 day", "2 days". Pass the plural when adding an "s" is wrong. */
export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** XP and gem totals never use a thousands separator: "1525". */
export function formatTotal(value: number): string {
  return String(Math.trunc(value));
}

/** Every other number over 999 is grouped: "12,345". */
export function formatNumber(value: number): string {
  return groupedNumber.format(value);
}

/** The streak label keeps "day" singular: "12 day streak". */
export function formatStreak(days: number): string {
  return `${days} day streak`;
}

/** An integer percentage, rounded half up: 92.5 → "93%". */
export function formatPercent(value: number): string {
  return `${Math.floor(value + 0.5)}%`;
}

/**
 * Time left in its largest whole unit, always rounded down so a countdown never promises more time than
 * there is: "6 days", "14 hours", "45 minutes", "30 seconds".
 */
export function formatCountdown(ms: number): string {
  const left = Math.max(0, ms);
  if (left >= DAY_MS) return pluralize(Math.floor(left / DAY_MS), "day");
  if (left >= HOUR_MS) return pluralize(Math.floor(left / HOUR_MS), "hour");
  if (left >= MINUTE_MS) return pluralize(Math.floor(left / MINUTE_MS), "minute");
  return pluralize(Math.floor(left / SECOND_MS), "second");
}

/** Lesson durations and timers as m:ss: 102 → "1:42", 30 → "0:30". */
export function formatClock(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/**
 * The calendar date a value names. A learner-local date ("2026-10-08") is taken as is; an instant uses its UTC
 * date, so output never depends on the device's time zone.
 */
function calendarDate(value: ISODate | ISODateTime): Date {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

/** List dates: "Oct 8". */
export function formatShortDate(value: ISODate | ISODateTime): string {
  return shortDate.format(calendarDate(value));
}

/** Calendar headers and "Joined …" lines: "October 2026". */
export function formatMonthYear(value: ISODate | ISODateTime): string {
  return monthYear.format(calendarDate(value));
}
