import type { DailyGoalOut, ISODate } from "@/lib/api/types";

const MONTH = new Intl.DateTimeFormat("en-US", { month: "long", timeZone: "UTC" });

export function dailyGoalMessage({ goalXp, earnedXp, met }: DailyGoalOut): string {
  if (met) return "Daily goal complete! Nice work!";
  return `Earn ${Math.max(0, goalXp - earnedXp)} more XP to reach your daily goal`;
}

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
