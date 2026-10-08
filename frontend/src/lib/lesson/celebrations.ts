import type {
  AchievementUnlockOut,
  CompletionOut,
  CompletionStreak,
  DayState,
  ISODate,
  QuestCompletedOut,
  StreakDayOut,
  XpLineOut,
} from "@/lib/api/types";
import { ACCOLADES, STAT_LABELS, SUMMARY_TITLES } from "./copy";

export type TimeLabel = typeof STAT_LABELS.speedy | typeof STAT_LABELS.committed;
export type AccuracyLabel =
  | typeof STAT_LABELS.amazing
  | typeof STAT_LABELS.great
  | typeof STAT_LABELS.goodPlus
  | typeof STAT_LABELS.good;

/** One leg of the TOTAL XP count-up: the card shows `label` while its number counts on to `to`. */
export interface XpPhase {
  label: string;
  to: number;
}

/** What the first screen after a lesson, practice or legendary run shows. */
export interface LessonSummary {
  title: string;
  /** A line under the title for regular learners; null when none applies. */
  accolade: string | null;
  /** Base XP, then the combo bonus, then the boost. */
  xpPhases: XpPhase[];
  time: { label: TimeLabel; seconds: number };
  accuracy: { label: AccuracyLabel; percent: number };
}

/** One step of the sequence after a session: a full screen, or an achievement modal over the last screen. */
export type Celebration =
  | ({ kind: "summary" } & LessonSummary)
  | { kind: "timedResult"; completion: CompletionOut }
  | { kind: "quests"; quests: QuestCompletedOut[] }
  | ({ kind: "streak" } & CompletionStreak)
  | { kind: "heartEarned"; hearts: number }
  | { kind: "legendary"; nodeTitle: string }
  | { kind: "achievement"; achievement: AchievementUnlockOut };

/** The steps that fill the screen. */
export type SlideCelebration = Exclude<Celebration, { kind: "achievement" }>;

/** Accolades are for regular learners: at least this many sessions in the last seven days. */
const ACCOLADE_MIN_RECENT_SESSIONS = 5;
const SPEEDY_UNDER_SECONDS = 120;
const LONG_OVER_SECONDS = 420;
const BIG_XP = 30;

/** The steps to show after a session, in order. Steps that do not apply are left out. */
export function buildCelebrations(c: CompletionOut): Celebration[] {
  const steps: Celebration[] = [
    c.kind === "timed" ? { kind: "timedResult", completion: c } : { kind: "summary", ...summary(c) },
  ];
  // The server lists the daily goal (quest slot 1) first.
  if (c.questsCompleted.length) steps.push({ kind: "quests", quests: c.questsCompleted });
  if (c.streak.extendedToday) steps.push({ kind: "streak", ...c.streak });
  if (c.heartsGained > 0) steps.push({ kind: "heartEarned", hearts: c.me.hearts.current });
  if (c.node?.legendaryNow) steps.push({ kind: "legendary", nodeTitle: c.node.title });
  for (const achievement of c.achievementsUnlocked) steps.push({ kind: "achievement", achievement });
  return steps;
}

export function summary(c: CompletionOut): LessonSummary {
  // Rounded half up once, so the label and the number shown always agree.
  const percent = Math.floor(c.stats.accuracyPercent + 0.5);
  return {
    title: summaryTitle(c),
    accolade: accolade(c),
    xpPhases: xpPhases(c.xp.lines, c.me.xpBoost.multiplier),
    time: { label: timeLabel(c.stats.durationSeconds), seconds: c.stats.durationSeconds },
    accuracy: { label: accuracyLabel(percent), percent },
  };
}

export function summaryTitle(c: CompletionOut): string {
  const unitReview = c.kind === "lesson" && c.node?.kind === "review";
  if (c.kind === "legendary" || unitReview) return SUMMARY_TITLES.challenge;
  if (c.kind === "practice") return SUMMARY_TITLES.practice;
  return c.stats.accuracyPercent === 100 ? SUMMARY_TITLES.perfect : SUMMARY_TITLES.lesson;
}

/**
 * Every accolade that fits the session, then one picked by session id: the same session always shows the same
 * line, and consecutive sessions vary.
 */
export function accolade(c: CompletionOut): string | null {
  if (c.recentSessionCount < ACCOLADE_MIN_RECENT_SESSIONS) return null;
  const { perfect, durationSeconds } = c.stats;
  const candidates = [
    perfect && ACCOLADES.perfect,
    durationSeconds < SPEEDY_UNDER_SECONDS && ACCOLADES.fast(durationSeconds),
    durationSeconds > LONG_OVER_SECONDS && ACCOLADES.slow(durationSeconds),
    c.xp.total >= BIG_XP && ACCOLADES.xp(c.xp.total),
  ].filter((line): line is string => typeof line === "string");
  return candidates.length > 0 ? candidates[c.sessionId % candidates.length] : null;
}

export function accuracyLabel(percent: number): AccuracyLabel {
  if (percent >= 100) return STAT_LABELS.amazing;
  if (percent >= 90) return STAT_LABELS.great;
  if (percent >= 85) return STAT_LABELS.goodPlus;
  return STAT_LABELS.good;
}

export function timeLabel(seconds: number): TimeLabel {
  return seconds < SPEEDY_UNDER_SECONDS ? STAT_LABELS.speedy : STAT_LABELS.committed;
}

function xpFrom(lines: readonly XpLineOut[], counts: (line: XpLineOut) => boolean): number {
  return lines.filter(counts).reduce((sum, line) => sum + line.amount, 0);
}

/**
 * How the TOTAL XP card counts: the session's own XP first, then the label swaps to COMBO while the combo
 * bonus counts on, then to the boost multiplier ("2X") while the boost does.
 */
export function xpPhases(lines: readonly XpLineOut[], boostMultiplier: number): XpPhase[] {
  const base = xpFrom(lines, (line) => line.reason !== "combo" && line.reason !== "boost");
  const combo = xpFrom(lines, (line) => line.reason === "combo");
  const boost = xpFrom(lines, (line) => line.reason === "boost");
  const phases: XpPhase[] = [{ label: STAT_LABELS.totalXp, to: base }];
  if (combo > 0) phases.push({ label: STAT_LABELS.combo, to: base + combo });
  if (boost > 0) phases.push({ label: `${boostMultiplier}X`, to: base + combo + boost });
  return phases;
}

/** How a day looks on the streak screen's weekday strip. */
export type StripDayState = "extended" | "frozen" | "empty" | "nudge";

export interface StripDay {
  date: ISODate;
  /** 0 is Sunday, as `Date.getUTCDay()`. */
  weekday: number;
  state: StripDayState;
  isToday: boolean;
}

/** Under a five-day streak the strip aims at five days, then at seven. */
const SHORT_STRIP_DAYS = 5;
const FULL_STRIP_DAYS = 7;

const PAST_DAY_STATE: Record<DayState, StripDayState> = { active: "extended", frozen: "frozen", none: "empty" };

/**
 * The weekday strip of the streak screen. It shows the streak's days up to today, then the days still to go to
 * the next goal (five days while the streak is under five, otherwise seven), tomorrow first as a nudge. A
 * streak that fills the strip shows its last days, ending today. `week` is the receipt's last seven local
 * days, ending today.
 */
export function weekStrip(week: readonly StreakDayOut[], after: number): StripDay[] {
  const today = week.at(-1);
  if (!today) return [];
  const size = after < SHORT_STRIP_DAYS ? SHORT_STRIP_DAYS : FULL_STRIP_DAYS;
  const shown = week.slice(Math.max(streakRunStart(week), week.length - size));
  const past = shown.map(
    (day, index): StripDay => ({
      date: day.date,
      weekday: weekdayOf(day.date),
      state: PAST_DAY_STATE[day.state],
      isToday: index === shown.length - 1,
    }),
  );
  const ahead = Array.from({ length: size - past.length }, (_, index): StripDay => {
    const date = addDays(today.date, index + 1);
    return { date, weekday: weekdayOf(date), state: index === 0 ? "nudge" : "empty", isToday: false };
  });
  return [...past, ...ahead];
}

/** Where the run of streak days (active or frozen) that ends today begins. Today always counts. */
function streakRunStart(week: readonly StreakDayOut[]): number {
  let start = week.length - 1;
  while (start > 0 && week[start - 1].state !== "none") start -= 1;
  return start;
}

/** Calendar dates are learner-local, so the arithmetic runs in UTC where no device time zone can shift it. */
function toUtcDate(date: ISODate): Date {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function weekdayOf(date: ISODate): number {
  return toUtcDate(date).getUTCDay();
}

function addDays(date: ISODate, days: number): ISODate {
  const next = toUtcDate(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

/**
 * The screen to show at step `index`: the step itself, or for an achievement the latest screen before it,
 * which stays behind the achievement's modal.
 */
export function slideFor(
  steps: readonly Celebration[],
  index: number,
): { slide: SlideCelebration; slideIndex: number } | null {
  for (let candidate = Math.min(index, steps.length - 1); candidate >= 0; candidate -= 1) {
    const step = steps[candidate];
    if (step.kind !== "achievement") return { slide: step, slideIndex: candidate };
  }
  return null;
}
