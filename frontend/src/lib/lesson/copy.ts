import type { AchievementUnlockOut, QuestCompletedOut } from "@/lib/api/types";
import { APP_NAME } from "@/lib/constants";
import { formatNumber, formatTotal, pluralize } from "@/lib/format";

/*
 * The words of the screens shown after a session. Button labels are written in sentence case because the
 * Button uppercases them; stat-card labels are shown exactly as written.
 */

export const COMPLETION_COPY = {
  continue: "Continue",
  reviewLesson: "Review lesson",
  viewAchievements: "View achievements",
  gotIt: "Got it",
  scorecardTitle: "Check out your scorecard!",
  yourAnswer: "Your answer:",
  correctAnswer: "Correct answer:",
  correct: "Correct",
  incorrect: "Incorrect",
  dayStreak: "day streak!",
  heartTitle: "You gained another heart!",
  heartBody: "You need hearts to start new lessons!",
  legendaryTitle: "You earned Legendary on this level!",
  legendaryBody: "Congratulations! You've proven your skills and unlocked a special color",
} as const;

export const SUMMARY_TITLES = {
  lesson: "Lesson Complete!",
  perfect: "Perfect lesson!",
  practice: "Practice Complete!",
  challenge: "Challenge complete!",
} as const;

export const STAT_LABELS = {
  totalXp: "TOTAL XP",
  combo: "COMBO",
  speedy: "SPEEDY",
  committed: "COMMITTED",
  amazing: "AMAZING",
  great: "GREAT!",
  goodPlus: "GOOD!",
  good: "GOOD",
} as const;

/** Weekday labels of the streak strip, indexed like `Date.getUTCDay()` (0 is Sunday). */
export const DAY_LETTERS = ["Su", "M", "Tu", "W", "Th", "F", "Sa"] as const;

const SECONDS_PER_MINUTE = 60;

/**
 * Accolades under the summary title. Durations become whole minutes that keep the sentence true: "under"
 * rounds up past the time (59 s is under 1 minute, 60 s under 2), "over" rounds down below it.
 */
export const ACCOLADES = {
  perfect: "You made no mistakes in this lesson",
  fast: (seconds: number) =>
    `You completed this lesson in under ${pluralize(Math.floor(seconds / SECONDS_PER_MINUTE) + 1, "minute")}`,
  slow: (seconds: number) =>
    `This lesson took over ${pluralize(Math.ceil(seconds / SECONDS_PER_MINUTE) - 1, "minute")}. Way to power through!`,
  xp: (xp: number) => `You earned ${formatTotal(xp)} XP in this lesson`,
};

const NEW_STREAK_BODIES = [
  "Practicing daily grows your streak, but skipping a day resets it!",
  "Practice each day so your streak won't reset!",
  "But your streak will reset if you don't practice tomorrow. Watch out!",
] as const;

/** Days 4 to 6 count down to the next short goal. */
const COUNTDOWN_BODIES: Partial<Record<number, string>> = {
  4: "You're one day away from a 5 day streak",
  5: "You're two days away from a 7 day streak",
  6: "You're one day away from a 7 day streak",
};

function longStreakBodies(after: number): string[] {
  return [
    "You're making great progress!",
    "You're on fire! Keep the flame lit every day!",
    "You're crushing your learning goals. Keep it up!",
    "What a streak! Keep it going every day.",
    `Keep learning tomorrow to make it ${after + 1}!`,
  ];
}

/**
 * The message under the streak strip, by streak length. Where several messages fit, `dateSeed` (the local
 * date) picks one, so the message changes from day to day but stays put if the screen is shown again.
 */
export function streakBody(after: number, milestone: boolean, dateSeed: string): string {
  if (milestone) return `Congrats on using ${APP_NAME} for ${after} days in a row`;
  const countdown = COUNTDOWN_BODIES[after];
  if (countdown) return countdown;
  return pickBySeed(after < 4 ? NEW_STREAK_BODIES : longStreakBodies(after), dateSeed);
}

/** A stable choice: a small string hash, so the same seed always picks the same item. */
function pickBySeed<T>(items: readonly T[], seed: string): T {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return items[hash % items.length];
}

export interface ScreenCopy {
  title: string;
  body: string;
}

const DAILY_GOAL_QUEST = "daily_goal";

/** One screen for every quest the session completed; their gems are added up. */
export function questRewardCopy(quests: readonly QuestCompletedOut[]): ScreenCopy {
  const gems = quests.reduce((sum, quest) => sum + quest.rewardGems, 0);
  return { title: `You earned ${pluralize(gems, "gem")}!`, body: questRewardBody(quests) };
}

function questRewardBody(quests: readonly QuestCompletedOut[]): string {
  if (quests.some((quest) => quest.code === DAILY_GOAL_QUEST)) return "Nice job reaching your daily goal!";
  // Quest titles are instructions ("Complete 2 lessons"), so a single quest is quoted by name.
  if (quests.length === 1) return `You completed the “${quests[0].title}” quest!`;
  return `You completed ${quests.length} quests!`;
}

/** The unlock modal: the achievement's name, then what reaching this level took. */
export function achievementCopy(achievement: AchievementUnlockOut): ScreenCopy {
  return { title: `${achievement.name} unlocked!`, body: achievementBody(achievement) };
}

function achievementBody({ code, level, threshold, description }: AchievementUnlockOut): string {
  switch (code) {
    case "wildfire":
      return `You reached a ${threshold} day streak`;
    case "sage":
      return `You earned ${formatTotal(threshold)} XP`;
    case "scholar":
      return `You learned ${formatNumber(threshold)} new words in a single course`;
    case "sharpshooter":
      return `You completed ${pluralize(threshold, "lesson")} with no mistakes`;
    case "champion":
      // A session can only reach level 1 (the 10th session unlocks leaderboards); later levels come at week end.
      return level === 1 ? "You unlocked Leaderboards!" : description;
    case "winner":
    case "legendary":
      // Reached when a league week closes, never by a session; the server's description says it best.
      return description;
  }
}

/** The result of a timed run. Without a correct answer there is no XP to announce. */
export function timedResultCopy(xp: number, correct: number): ScreenCopy {
  if (correct === 0) return { title: "Time's up!", body: "Practice a little more and try again!" };
  return {
    title: `You won ${formatTotal(xp)} XP!`,
    body: `You answered ${pluralize(correct, "question")} correctly. Great job!`,
  };
}
