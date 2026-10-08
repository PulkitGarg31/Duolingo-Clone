import type { ISODate, ISODateTime } from "@/lib/api/types";

const MONTH = new Intl.DateTimeFormat("en-US", { month: "long", timeZone: "UTC" });
const DAY_MS = 86_400_000;

/** How far through today's quests the learner is; null before the first one is done. */
export function questsStatus(completedCount: number, total: number): string | null {
  if (completedCount <= 0) return null;
  if (completedCount >= total) return "All Daily Quests complete!";
  return `You've completed ${completedCount} out of ${total} quests today.`;
}

/** "October" for a learner-local date such as "2026-10-08", read as a calendar date rather than an instant. */
export function monthName(localDate: ISODate): string {
  const [year, month, day] = localDate.split("-").map(Number);
  return MONTH.format(new Date(Date.UTC(year, month - 1, day)));
}

/**
 * When the learner's month ends: the next local midnight (`resetsAt`, from the quests) plus the whole days left
 * after today. The monthly quest counts down to it.
 */
export function monthEndsAt(localDate: ISODate, resetsAt: ISODateTime): ISODateTime {
  const [year, month, day] = localDate.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return new Date(Date.parse(resetsAt) + (daysInMonth - day) * DAY_MS).toISOString();
}
