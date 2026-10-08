import { pluralize } from "@/lib/format";

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

/** Leaderboards open after this many finished lessons; the server applies the same rule. */
const UNLOCK_LESSONS = 10;

/** The line under the league name. Diamond, the top league, promotes nobody. */
export function promotionSubtitle(promoteCount: number): string {
  if (promoteCount <= 0) return "You've reached the top league!";
  if (promoteCount === 1) return "First place advances to the next league";
  return `Top ${promoteCount} advance to the next league`;
}

/** Which unit the week's countdown is counting in, which also picks its colour. */
export type CountdownTone = "days" | "hours" | "minutes";

export function countdownTone(msLeft: number): CountdownTone {
  if (msLeft >= DAY_MS) return "days";
  if (msLeft >= HOUR_MS) return "hours";
  return "minutes";
}

export function unlockMessage(lessonsToUnlock: number): string {
  return `Complete ${pluralize(lessonsToUnlock, "more lesson", "more lessons")} to start competing`;
}

/** The locked page's progress bar: lessons done out of the ten that unlock leaderboards. */
export function unlockProgress(lessonsToUnlock: number): { done: number; total: number } {
  const done = Math.min(UNLOCK_LESSONS, Math.max(0, UNLOCK_LESSONS - lessonsToUnlock));
  return { done, total: UNLOCK_LESSONS };
}
