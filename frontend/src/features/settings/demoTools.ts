import type { ClockChangeOut, DevLearnerPatchIn, ISODate, LeagueResultOut, SyncEffectsOut } from "@/lib/api/types";
import { pluralize } from "@/lib/format";

/*
 * The Demo tools card: which `/dev/*` call each button makes and the toast that reports what happened.
 * Everything here is pure; `useDemoTools` makes the calls.
 */

/** Time travel. Each is one `/dev/clock/*` call, except SKIP A DAY, which may make two. */
export type ClockAction = "hour" | "fiveHours" | "nextDay" | "skipDay" | "nextWeek";
/** Learner shortcuts, each one `PATCH /dev/learner`. */
export type LearnerAction = "drainHearts" | "refillHearts" | "addGems";
export type DemoAction = ClockAction | LearnerAction;
/** What a Demo tools card can have in flight: one of its buttons, or the reset. */
export type DemoTask = DemoAction | "reset";

/** The button grid, in reading order. Labels are uppercased by the button. */
export const DEMO_BUTTONS: readonly { action: DemoAction; label: string }[] = [
  { action: "hour", label: "+1 hour" },
  { action: "fiveHours", label: "+5 hours" },
  { action: "nextDay", label: "Next day" },
  { action: "skipDay", label: "Skip a day" },
  { action: "nextWeek", label: "End league week" },
  { action: "drainHearts", label: "Drain hearts" },
  { action: "refillHearts", label: "Refill hearts" },
  { action: "addGems", label: "+500 gems" },
];

const CLOCK_ACTIONS: ReadonlySet<DemoAction> = new Set<ClockAction>(["hour", "fiveHours", "nextDay", "skipDay", "nextWeek"]);

export function isClockAction(action: DemoAction): action is ClockAction {
  return CLOCK_ACTIONS.has(action);
}

const GEM_GIFT = 500;
const DAY_SECONDS = 86_400;
const HOUR_SECONDS = 3_600;

// ---------------------------------------------------------------------------------------------- time travel

/**
 * SKIP A DAY must miss exactly one local day. Without a lesson today, one jump to the next midnight leaves
 * today empty; after today's lesson, a second jump leaves tomorrow empty instead. Midnight jumps stay right
 * across daylight-saving changes, where a fixed 48 hours would not.
 */
export function nextDayCallsToSkipADay(extendedToday: boolean): 1 | 2 {
  return extendedToday ? 2 : 1;
}

/** The effects of two jumps in a row, reported as one. */
export function mergeEffects(first: SyncEffectsOut, second: SyncEffectsOut): SyncEffectsOut {
  return {
    heartsGained: first.heartsGained + second.heartsGained,
    streak: {
      before: first.streak.before,
      after: second.streak.after,
      freezesUsed: first.streak.freezesUsed + second.streak.freezesUsed,
      lost: first.streak.lost || second.streak.lost,
    },
    leagueResults: [...first.leagueResults, ...second.leagueResults],
    sessionsExpired: first.sessionsExpired + second.sessionsExpired,
  };
}

const JUMP_LINES: Record<ClockAction, string> = {
  hour: "Jumped ahead 1 hour.",
  fiveHours: "Jumped ahead 5 hours.",
  nextDay: "Jumped to tomorrow.",
  skipDay: "Skipped a day.",
  nextWeek: "Jumped to next week.",
};

/** The learner's day just before the jump, from `me`. */
export interface DayBeforeJump {
  localDate: ISODate;
  extendedToday: boolean;
}

function streakLine(streak: SyncEffectsOut["streak"], todayDone: boolean): string | null {
  if (streak.lost) return `Your ${streak.before} day streak was lost. Start a new one today!`;
  if (streak.freezesUsed > 0) return `A Streak Freeze kept your ${streak.after} day streak alive.`;
  if (streak.after > 0 && !todayDone) return `Do a lesson to keep your ${streak.after} day streak!`;
  return null;
}

/** "Jumped to tomorrow. +1 heart regenerated. Do a lesson to keep your 13 day streak!" */
export function clockToast(action: ClockAction, { clock, effects }: ClockChangeOut, before: DayBeforeJump): string {
  // A jump within the same day keeps today's lesson; a new day starts with none.
  const todayDone = clock.localDate === before.localDate && before.extendedToday;
  const lines = [JUMP_LINES[action]];
  if (effects.heartsGained > 0) lines.push(`+${pluralize(effects.heartsGained, "heart")} regenerated.`);
  const streak = streakLine(effects.streak, todayDone);
  if (streak) lines.push(streak);
  return lines.join(" ");
}

/**
 * The league result to announce on the settings page: the learner's unseen result, but only when it belongs to
 * a week that one of this visit's jumps finished (`finishedIds`). Any older unseen result greets the learner
 * on the path instead.
 */
export function weekResultToShow(pending: LeagueResultOut | null, finishedIds: readonly number[]): LeagueResultOut | null {
  return pending !== null && finishedIds.includes(pending.membershipId) ? pending : null;
}

/** "Real time + 1 day 5 h"; minutes only count while the jump is under an hour. */
export function formatOffset(offsetSeconds: number): string {
  const days = Math.floor(offsetSeconds / DAY_SECONDS);
  const hours = Math.floor((offsetSeconds % DAY_SECONDS) / HOUR_SECONDS);
  const minutes = Math.floor((offsetSeconds % HOUR_SECONDS) / 60);
  const parts: string[] = [];
  if (days > 0) parts.push(pluralize(days, "day"));
  if (hours > 0) parts.push(`${hours} h`);
  if (parts.length === 0 && minutes > 0) parts.push(`${minutes} min`);
  return parts.length > 0 ? `Real time + ${parts.join(" ")}` : "Real time";
}

/** "Thu, Oct 8 · 7:42 PM" in the learner's time zone. */
export function formatSimulatedTime(instantMs: number, timeZone: string): string {
  const date = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short", month: "short", day: "numeric" });
  const time = new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit" });
  // Recent ICU versions put a narrow no-break space before AM/PM; keep the output predictable.
  return `${date.format(instantMs)} · ${time.format(instantMs)}`.replace(/\u202f/g, " ");
}

// ------------------------------------------------------------------------------------------ learner shortcuts

/** The parts of `me` the learner shortcuts read. */
export interface LearnerCounts {
  gems: number;
  hearts: { current: number; max: number };
}

export function learnerPatch(action: LearnerAction, me: LearnerCounts): DevLearnerPatchIn {
  switch (action) {
    case "drainHearts":
      return { hearts: 0 };
    case "refillHearts":
      return { hearts: me.hearts.max };
    case "addGems":
      return { gems: me.gems + GEM_GIFT };
  }
}

/** Confirms a shortcut from the learner the server sent back. */
export function learnerToast(action: LearnerAction, after: LearnerCounts): string {
  return action === "addGems" ? `+${GEM_GIFT} gems added.` : `Hearts set to ${after.hearts.current}.`;
}
