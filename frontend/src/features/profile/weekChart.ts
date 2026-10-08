import type { ActivityDayOut, ISODate } from "@/lib/api/types";

/*
 * The "XP this week" chart: the seven learner-local days ending today. Dates stay "YYYY-MM-DD" strings and the
 * arithmetic runs on UTC midnights, so the device's own time zone can never shift a day.
 */

const DAY_MS = 86_400_000;
const WEEKDAY_INITIALS = ["S", "M", "T", "W", "T", "F", "S"] as const;

function toUtcMs(date: ISODate): number {
  const [year, month, day] = date.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

export function addDays(date: ISODate, days: number): ISODate {
  return new Date(toUtcMs(date) + days * DAY_MS).toISOString().slice(0, 10);
}

export interface WeekBar {
  date: ISODate;
  xp: number;
  /** Height as a share of the chart's top value, from 0 to 1. */
  ratio: number;
  goalMet: boolean;
  isToday: boolean;
  /** "M", "T", … */
  initial: string;
}

export interface WeekChart {
  bars: WeekBar[];
  /** The value at the top of the chart: the best day or the goal, whichever is higher. */
  max: number;
  /** Height of the daily-goal line, as a share of `max`. */
  goalRatio: number;
  total: number;
}

/** The seven days ending today, scaled so the best day and the daily goal both fit. */
export function buildWeek(activity: readonly ActivityDayOut[], today: ISODate, goalXp: number): WeekChart {
  const byDate = new Map(activity.map((day) => [day.date, day]));
  const dates = Array.from({ length: 7 }, (_, index) => addDays(today, index - 6));
  const xpOf = (date: ISODate) => byDate.get(date)?.xp ?? 0;
  const max = Math.max(goalXp, ...dates.map(xpOf), 1);
  return {
    bars: dates.map((date) => ({
      date,
      xp: xpOf(date),
      ratio: xpOf(date) / max,
      goalMet: byDate.get(date)?.goalMet ?? false,
      isToday: date === today,
      initial: WEEKDAY_INITIALS[new Date(toUtcMs(date)).getUTCDay()],
    })),
    max,
    goalRatio: goalXp / max,
    total: dates.reduce((sum, date) => sum + xpOf(date), 0),
  };
}
