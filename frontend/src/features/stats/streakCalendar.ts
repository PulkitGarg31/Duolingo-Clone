import type { ActivityDayOut, ISODate } from "@/lib/api/types";

/*
 * The streak popover's month calendar. Dates are learner-local calendar dates ("2026-10-08"), so all the
 * arithmetic happens on UTC midnights, where no device time zone can shift a day.
 */

/** A calendar month; `month` runs from 1 (January) to 12. */
export interface CalendarMonth {
  year: number;
  month: number;
}

/**
 * How a day sits in a streak:
 * - `start`: the first day of a run, or a single-day run (a filled flame-orange circle);
 * - `today`: today, once the streak has been extended (also a filled circle);
 * - `frozen`: a Streak Freeze covered the day (a blue circle);
 * - `streak`: any other day of a run (on the band);
 * - `none`: not part of a streak.
 */
export type DayMark = "start" | "today" | "frozen" | "streak" | "none";

export interface CalendarDay {
  date: ISODate;
  day: number;
  mark: DayMark;
  isToday: boolean;
  isFuture: boolean;
  /** The streak band runs on into the previous / next cell of the same week row. */
  joinsPrevious: boolean;
  joinsNext: boolean;
}

const DAY_MS = 86_400_000;

function toTime(date: ISODate): number {
  const [year, month, day] = date.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function toDate(time: number): ISODate {
  return new Date(time).toISOString().slice(0, 10);
}

function addDays(date: ISODate, days: number): ISODate {
  return toDate(toTime(date) + days * DAY_MS);
}

export function monthOf(date: ISODate): CalendarMonth {
  const [year, month] = date.split("-").map(Number);
  return { year, month };
}

export function shiftMonth({ year, month }: CalendarMonth, delta: number): CalendarMonth {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

/** Negative, zero or positive as `a` comes before, is, or comes after `b`. */
export function compareMonths(a: CalendarMonth, b: CalendarMonth): number {
  return a.year * 12 + a.month - (b.year * 12 + b.month);
}

function firstDay({ year, month }: CalendarMonth): ISODate {
  return toDate(Date.UTC(year, month - 1, 1));
}

function daysIn({ year, month }: CalendarMonth): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * The activity range a month needs: from the day before the 1st, which tells whether the 1st continues a run,
 * to the month's last day, or today for the current month (the API never reads past today).
 */
export function monthFetchRange(month: CalendarMonth, today: ISODate): { from: ISODate; to: ISODate } {
  const lastDay = addDays(firstDay(month), daysIn(month) - 1);
  return { from: addDays(firstDay(month), -1), to: lastDay < today ? lastDay : today };
}

/** The month in Sunday-first weeks of 7 cells; cells outside the month are null. */
export function buildMonthGrid(month: CalendarMonth, days: readonly ActivityDayOut[], today: ISODate): (CalendarDay | null)[][] {
  const states = new Map(days.map((entry) => [entry.date, entry.state]));
  const inStreak = (date: ISODate) => {
    const state = states.get(date);
    return state === "active" || state === "frozen";
  };

  const first = firstDay(month);
  const leading = new Date(toTime(first)).getUTCDay();
  const cells: (CalendarDay | null)[] = Array.from({ length: leading }, () => null);
  const count = daysIn(month);

  for (let offset = 0; offset < count; offset++) {
    const date = addDays(first, offset);
    const column = (leading + offset) % 7;
    const streak = inStreak(date);
    cells.push({
      date,
      day: offset + 1,
      mark: markFor(states.get(date) === "frozen", streak, inStreak(addDays(date, -1)), date === today),
      isToday: date === today,
      isFuture: date > today,
      joinsPrevious: streak && column > 0 && offset > 0 && inStreak(addDays(date, -1)),
      joinsNext: streak && column < 6 && offset < count - 1 && inStreak(addDays(date, 1)),
    });
  }

  while (cells.length % 7 !== 0) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, week) => cells.slice(week * 7, week * 7 + 7));
}

function markFor(frozen: boolean, streak: boolean, previousInStreak: boolean, isToday: boolean): DayMark {
  if (frozen) return "frozen";
  if (!streak) return "none";
  if (isToday) return "today";
  return previousInStreak ? "streak" : "start";
}
