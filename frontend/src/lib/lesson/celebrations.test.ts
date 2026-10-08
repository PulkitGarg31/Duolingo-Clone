import { describe, expect, it } from "vitest";
import type {
  AchievementUnlockOut,
  CompletionNode,
  CompletionOut,
  MeOut,
  QuestCompletedOut,
  StreakDayOut,
} from "@/lib/api/types";
import {
  accolade,
  accuracyLabel,
  buildCelebrations,
  slideFor,
  summary,
  summaryTitle,
  timeLabel,
  weekStrip,
  xpPhases,
  type Celebration,
} from "./celebrations";

const ME: MeOut = {
  user: {
    id: 1,
    username: "alex",
    displayName: "Alex",
    avatarColor: "#1CB0F6",
    timezone: "Asia/Kolkata",
    timezoneConfirmed: true,
    joinedAt: "2026-09-08T06:30:00Z",
  },
  course: {
    id: 1,
    slug: "es-en",
    title: "Spanish",
    learningLanguage: "es",
    fromLanguage: "en",
    ttsLocale: "es-ES",
    flagKey: "es",
    isPublished: true,
  },
  serverNow: "2026-10-08T12:01:45Z",
  localDate: "2026-10-08",
  xp: { total: 388, today: 15, thisWeek: 57 },
  gems: 820,
  hearts: {
    current: 4,
    max: 5,
    nextHeartAt: "2026-10-08T16:00:00Z",
    fullAt: "2026-10-08T16:00:00Z",
    regenIntervalSeconds: 18000,
    refillPriceGems: 350,
  },
  streak: {
    current: 14,
    longest: 14,
    status: "extended",
    extendedToday: true,
    frozenYesterday: false,
    freezesEquipped: 1,
    maxFreezes: 2,
    nextMilestone: 30,
  },
  dailyGoal: { goalXp: 20, earnedXp: 15, met: false },
  league: {
    unlocked: true,
    lessonsToUnlock: 0,
    tier: 2,
    name: "Silver",
    color: "#C9D6E2",
    joinedThisWeek: true,
    rank: 14,
    weeklyXp: 57,
    zone: "safe",
    xpToPassNext: 4,
    cohortSize: 30,
    promoteCount: 15,
    demoteCount: 7,
    weekEndsAt: "2026-10-12T00:00:00Z",
  },
  xpBoost: { active: false, endsAt: null, multiplier: 2 },
  activeSession: null,
  pendingLeagueResult: null,
  settings: {
    dailyGoalXp: 20,
    theme: "system",
    soundEffects: true,
    animations: true,
    motivationalMessages: true,
    listeningExercises: true,
    timezone: "Asia/Kolkata",
  },
  dev: { enabled: true, clockOffsetSeconds: 0 },
};

const WEEK: StreakDayOut[] = [
  { date: "2026-10-02", state: "frozen" },
  { date: "2026-10-03", state: "active" },
  { date: "2026-10-04", state: "active" },
  { date: "2026-10-05", state: "active" },
  { date: "2026-10-06", state: "active" },
  { date: "2026-10-07", state: "active" },
  { date: "2026-10-08", state: "active" },
];

const DRINKS: CompletionNode = {
  id: 6,
  kind: "skill",
  title: "Drinks",
  lessonsCompleted: 2,
  lessonCount: 3,
  completedNow: false,
  legendaryNow: false,
  unlockedNodeIds: [],
};

/** The golden lesson: Drinks, lesson 2 of 3, all correct in 98 s, extending a 13-day streak to the 14 milestone. */
const LESSON: CompletionOut = {
  sessionId: 14,
  kind: "lesson",
  replayed: false,
  xp: {
    total: 15,
    lines: [
      { reason: "lesson", amount: 10 },
      { reason: "combo", amount: 5 },
    ],
    boostActive: false,
  },
  stats: { accuracyPercent: 100, durationSeconds: 98, mistakes: 0, bestCombo: 6, perfect: true, itemCount: 6 },
  streak: { before: 13, after: 14, extendedToday: true, isNewRecord: true, milestone: true, week: WEEK },
  dailyGoal: { goalXp: 20, before: 0, after: 15, justMet: false },
  node: DRINKS,
  heartsGained: 0,
  questsCompleted: [],
  achievementsUnlocked: [],
  league: {
    joinedNow: false,
    league: { tier: 2, name: "Silver", color: "#C9D6E2" },
    weeklyXp: 57,
    rankBefore: 17,
    rankAfter: 14,
  },
  timed: null,
  recentSessionCount: 6,
  me: ME,
};

const DAILY_GOAL: QuestCompletedOut = { code: "daily_goal", title: "Earn 20 XP", rewardGems: 10 };
const WILDFIRE: AchievementUnlockOut = {
  code: "wildfire",
  name: "Wildfire",
  level: 3,
  threshold: 14,
  description: "Reach a 14 day streak",
  color: "#FF9600",
};
const SAGE: AchievementUnlockOut = {
  code: "sage",
  name: "Sage",
  level: 2,
  threshold: 250,
  description: "Earn 250 XP",
  color: "#1CB0F6",
};

function receipt(changes: Partial<CompletionOut>): CompletionOut {
  return { ...LESSON, ...changes };
}

function withStats(changes: Partial<CompletionOut["stats"]>, rest: Partial<CompletionOut> = {}): CompletionOut {
  return receipt({ ...rest, stats: { ...LESSON.stats, ...changes } });
}

const kinds = (steps: Celebration[]) => steps.map((step) => step.kind);

describe("buildCelebrations", () => {
  it("runs summary, quests, streak, heart, legendary, then one step per achievement", () => {
    const everything = receipt({
      questsCompleted: [DAILY_GOAL],
      heartsGained: 1,
      node: { ...DRINKS, legendaryNow: true },
      achievementsUnlocked: [WILDFIRE, SAGE],
    });

    expect(kinds(buildCelebrations(everything))).toEqual([
      "summary",
      "quests",
      "streak",
      "heartEarned",
      "legendary",
      "achievement",
      "achievement",
    ]);
  });

  it("opens a timed run with its result instead of the summary", () => {
    const timed = receipt({ kind: "timed", node: null, timed: { correct: 12, answered: 15, timeUp: true } });

    const [first] = buildCelebrations(timed);

    expect(first).toEqual({ kind: "timedResult", completion: timed });
  });

  it("shows only the summary when nothing else happened", () => {
    const quiet = receipt({ streak: { ...LESSON.streak, extendedToday: false } });

    expect(kinds(buildCelebrations(quiet))).toEqual(["summary"]);
  });

  it("skips the legendary step when there is no node", () => {
    const practice = receipt({ kind: "practice", node: null, heartsGained: 1 });

    expect(kinds(buildCelebrations(practice))).toEqual(["summary", "streak", "heartEarned"]);
  });

  it("gives each step the data it shows", () => {
    const steps = buildCelebrations(
      receipt({
        questsCompleted: [DAILY_GOAL],
        heartsGained: 1,
        node: { ...DRINKS, legendaryNow: true },
        achievementsUnlocked: [WILDFIRE],
      }),
    );

    expect(steps[1]).toEqual({ kind: "quests", quests: [DAILY_GOAL] });
    expect(steps[2]).toEqual({ kind: "streak", ...LESSON.streak });
    expect(steps[3]).toEqual({ kind: "heartEarned", hearts: 4 });
    expect(steps[4]).toEqual({ kind: "legendary", nodeTitle: "Drinks" });
    expect(steps[5]).toEqual({ kind: "achievement", achievement: WILDFIRE });
  });
});

describe("summaryTitle", () => {
  it("calls a lesson at 100 % accuracy perfect", () => {
    expect(summaryTitle(LESSON)).toBe("Perfect lesson!");
  });

  it("calls any other lesson complete", () => {
    expect(summaryTitle(withStats({ accuracyPercent: 93, mistakes: 1, perfect: false }))).toBe("Lesson Complete!");
  });

  it("names practice, even a flawless one", () => {
    expect(summaryTitle(receipt({ kind: "practice" }))).toBe("Practice Complete!");
  });

  it("calls legendary runs and unit reviews challenges", () => {
    expect(summaryTitle(receipt({ kind: "legendary" }))).toBe("Challenge complete!");
    expect(summaryTitle(receipt({ node: { ...DRINKS, kind: "review" } }))).toBe("Challenge complete!");
  });
});

describe("accolade", () => {
  it("stays hidden below five sessions in the last seven days", () => {
    expect(accolade(receipt({ recentSessionCount: 4 }))).toBeNull();
  });

  it("appears from five sessions in the last seven days", () => {
    expect(accolade(receipt({ recentSessionCount: 5 }))).not.toBeNull();
  });

  it("picks among the candidates by session id, so a session always gets the same one", () => {
    // Perfect and under two minutes: two candidates, in that order.
    expect(accolade(receipt({ sessionId: 14 }))).toBe("You made no mistakes in this lesson");
    expect(accolade(receipt({ sessionId: 15 }))).toBe("You completed this lesson in under 2 minutes");
  });

  it("adds the XP candidate from 30 XP", () => {
    const big = receipt({ sessionId: 14, xp: { ...LESSON.xp, total: 30 } });

    expect(accolade(big)).toBe("You earned 30 XP in this lesson");
  });

  it("praises long lessons", () => {
    const slow = withStats({ durationSeconds: 425, mistakes: 2, perfect: false, accuracyPercent: 80 });

    expect(accolade(slow)).toBe("This lesson took over 7 minutes. Way to power through!");
  });

  it("is null when no candidate applies", () => {
    const plain = withStats({ durationSeconds: 200, mistakes: 1, perfect: false, accuracyPercent: 86 });

    expect(accolade(plain)).toBeNull();
  });
});

describe("stat labels", () => {
  it.each([
    [84, "GOOD"],
    [85, "GOOD!"],
    [89, "GOOD!"],
    [90, "GREAT!"],
    [99, "GREAT!"],
    [100, "AMAZING"],
  ])("labels an accuracy of %i as %s", (percent, label) => {
    expect(accuracyLabel(percent)).toBe(label);
  });

  it("calls a lesson under two minutes speedy", () => {
    expect(timeLabel(119)).toBe("SPEEDY");
    expect(timeLabel(120)).toBe("COMMITTED");
  });
});

describe("xpPhases", () => {
  it("counts the base XP, then the combo bonus", () => {
    expect(xpPhases(LESSON.xp.lines, 2)).toEqual([
      { label: "TOTAL XP", to: 10 },
      { label: "COMBO", to: 15 },
    ]);
  });

  it("ends with the boost, labelled by its multiplier", () => {
    const lines = [...LESSON.xp.lines, { reason: "boost" as const, amount: 15 }];

    expect(xpPhases(lines, 2)).toEqual([
      { label: "TOTAL XP", to: 10 },
      { label: "COMBO", to: 15 },
      { label: "2X", to: 30 },
    ]);
  });

  it("is a single count without bonuses", () => {
    expect(xpPhases([{ reason: "timed", amount: 12 }], 2)).toEqual([{ label: "TOTAL XP", to: 12 }]);
    expect(xpPhases([], 2)).toEqual([{ label: "TOTAL XP", to: 0 }]);
  });
});

describe("summary", () => {
  it("builds the screen from the receipt", () => {
    expect(summary(LESSON)).toEqual({
      title: "Perfect lesson!",
      accolade: "You made no mistakes in this lesson",
      xpPhases: [
        { label: "TOTAL XP", to: 10 },
        { label: "COMBO", to: 15 },
      ],
      time: { label: "SPEEDY", seconds: 98 },
      accuracy: { label: "AMAZING", percent: 100 },
    });
  });

  it("rounds accuracy half up before labelling it", () => {
    expect(summary(withStats({ accuracyPercent: 89.5, perfect: false })).accuracy).toEqual({
      label: "GREAT!",
      percent: 90,
    });
  });
});

describe("weekStrip", () => {
  const days = (states: StreakDayOut["state"][]): StreakDayOut[] =>
    states.map((state, index) => ({ date: WEEK[index + WEEK.length - states.length].date, state }));

  it("shows five days under a five-day streak: the streak so far, tomorrow's nudge, then empty days", () => {
    expect(weekStrip(days(["none", "none", "none", "none", "none", "active", "active"]), 2)).toEqual([
      { date: "2026-10-07", weekday: 3, state: "extended", isToday: false },
      { date: "2026-10-08", weekday: 4, state: "extended", isToday: true },
      { date: "2026-10-09", weekday: 5, state: "nudge", isToday: false },
      { date: "2026-10-10", weekday: 6, state: "empty", isToday: false },
      { date: "2026-10-11", weekday: 0, state: "empty", isToday: false },
    ]);
  });

  it("leaves only tomorrow open one day before a five-day streak", () => {
    const strip = weekStrip(days(["none", "none", "none", "active", "active", "active", "active"]), 4);

    expect(strip.map((day) => day.state)).toEqual(["extended", "extended", "extended", "extended", "nudge"]);
  });

  it("switches to seven days from a five-day streak", () => {
    const strip = weekStrip(days(["none", "none", "active", "active", "active", "active", "active"]), 5);

    expect(strip.map((day) => day.state)).toEqual([
      "extended",
      "extended",
      "extended",
      "extended",
      "extended",
      "nudge",
      "empty",
    ]);
  });

  it("shows the last seven days of a long streak, frozen days included", () => {
    const strip = weekStrip(WEEK, 14);

    expect(strip.map((day) => day.state)).toEqual([
      "frozen",
      "extended",
      "extended",
      "extended",
      "extended",
      "extended",
      "extended",
    ]);
    expect(strip.map((day) => day.weekday)).toEqual([5, 6, 0, 1, 2, 3, 4]);
    expect(strip.at(-1)?.isToday).toBe(true);
  });

  it("starts again after a missed day", () => {
    const strip = weekStrip(days(["active", "active", "active", "active", "active", "none", "active"]), 1);

    expect(strip.map((day) => [day.date, day.state])).toEqual([
      ["2026-10-08", "extended"],
      ["2026-10-09", "nudge"],
      ["2026-10-10", "empty"],
      ["2026-10-11", "empty"],
      ["2026-10-12", "empty"],
    ]);
  });
});

describe("slideFor", () => {
  const steps = buildCelebrations(receipt({ achievementsUnlocked: [WILDFIRE, SAGE] }));

  it("shows a screen step as itself", () => {
    expect(slideFor(steps, 1)).toEqual({ slide: steps[1], slideIndex: 1 });
  });

  it("keeps the screen before an achievement behind its modal", () => {
    expect(slideFor(steps, 3)).toEqual({ slide: steps[1], slideIndex: 1 });
  });

  it("has nothing to show without steps", () => {
    expect(slideFor([], 0)).toBeNull();
  });
});
