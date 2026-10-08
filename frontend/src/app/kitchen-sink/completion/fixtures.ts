import type { ReviewItem } from "@/features/lesson/ReviewScorecard";
import type { CompletionNode, CompletionOut, CompletionStreak, MeOut, StreakDayOut } from "@/lib/api/types";

/** The sample learner's `GET /me` right after the golden lesson. */
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

const WEEK_DATES = ["2026-10-02", "2026-10-03", "2026-10-04", "2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08"];

/** The last seven local days, ending today (2026-10-08), from their states. */
function week(...states: StreakDayOut["state"][]): StreakDayOut[] {
  return states.map((state, index) => ({ date: WEEK_DATES[index], state }));
}

/** A streak extended today, from `before` to `before + 1`. */
function extended(before: number, days: StreakDayOut[], milestone = false): CompletionStreak {
  return { before, after: before + 1, extendedToday: true, isNewRecord: false, milestone, week: days };
}

/** A later session the same day: the streak was already extended, so it gets no screen. */
const ALREADY_EXTENDED: CompletionStreak = {
  before: 14,
  after: 14,
  extendedToday: false,
  isNewRecord: false,
  milestone: false,
  week: week("frozen", "active", "active", "active", "active", "active", "active"),
};

/** Drinks, the skill node the golden lesson belongs to. */
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

/** `POST /sessions/14/complete`: Drinks, lesson 2 of 3, all correct, a 14-day milestone and Wildfire level 3. */
const GOLDEN_LESSON: CompletionOut = {
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
  streak: {
    before: 13,
    after: 14,
    extendedToday: true,
    isNewRecord: true,
    milestone: true,
    week: week("frozen", "active", "active", "active", "active", "active", "active"),
  },
  dailyGoal: { goalXp: 20, before: 0, after: 15, justMet: false },
  node: DRINKS,
  heartsGained: 0,
  questsCompleted: [],
  achievementsUnlocked: [
    { code: "wildfire", name: "Wildfire", level: 3, threshold: 14, description: "Reach a 14 day streak", color: "#FF9600" },
  ],
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

/** The golden lesson's answers, as the lesson player records them. */
const GOLDEN_ANSWERS: ReviewItem[] = [
  { prompt: "Which one of these is “the juice”?", given: "el jugo", correctAnswer: "el jugo", correct: true },
  { prompt: "Yo bebo agua.", given: "I drink water", correctAnswer: "I drink water.", correct: true },
  { prompt: "Tap the matching pairs", given: "4 pairs matched", correctAnswer: null, correct: true },
  { prompt: "Tú ___ agua.", given: "bebes", correctAnswer: "Tú bebes agua.", correct: true },
  { prompt: "I want a juice, please.", given: "Quiero un jugo por favor", correctAnswer: "Quiero un jugo, por favor.", correct: true },
  { prompt: "Type what you hear", given: "Quiero agua", correctAnswer: "Quiero agua.", correct: true },
];

/** The same lesson with two misses (each retried at the end) and a slow finish. */
const ANSWERS_WITH_MISTAKES: ReviewItem[] = [
  GOLDEN_ANSWERS[0],
  { prompt: "Yo bebo agua.", given: "I eat water", correctAnswer: "I drink water.", correct: false },
  GOLDEN_ANSWERS[2],
  GOLDEN_ANSWERS[3],
  { prompt: "I want a juice, please.", given: "Skipped", correctAnswer: "Quiero un jugo, por favor.", correct: false },
  GOLDEN_ANSWERS[5],
  GOLDEN_ANSWERS[1],
  GOLDEN_ANSWERS[4],
];

export const SCENARIO_IDS = [
  "golden",
  "mistakes",
  "practice",
  "review",
  "legendary",
  "boost",
  "quests",
  "timed",
  "timedZero",
  "unlocks",
] as const;

export type ScenarioId = (typeof SCENARIO_IDS)[number];

export interface Scenario {
  label: string;
  completion: CompletionOut;
  reviewItems?: ReviewItem[];
}

export const SCENARIOS: Record<ScenarioId, Scenario> = {
  golden: {
    label: "Perfect lesson · 14-day milestone · Wildfire",
    completion: GOLDEN_LESSON,
    reviewItems: GOLDEN_ANSWERS,
  },
  mistakes: {
    label: "Lesson with mistakes · day 4",
    completion: {
      ...GOLDEN_LESSON,
      sessionId: 21,
      xp: { total: 13, lines: [{ reason: "lesson", amount: 10 }, { reason: "combo", amount: 3 }], boostActive: false },
      stats: { accuracyPercent: 75, durationSeconds: 452, mistakes: 2, bestCombo: 3, perfect: false, itemCount: 6 },
      streak: extended(3, week("none", "none", "none", "active", "active", "active", "active")),
      achievementsUnlocked: [],
    },
    reviewItems: ANSWERS_WITH_MISTAKES,
  },
  practice: {
    label: "Practice · daily goal · +1 heart · day 2",
    completion: {
      ...GOLDEN_LESSON,
      sessionId: 22,
      kind: "practice",
      xp: { total: 15, lines: [{ reason: "practice", amount: 10 }, { reason: "combo", amount: 5 }], boostActive: false },
      stats: { accuracyPercent: 100, durationSeconds: 141, mistakes: 0, bestCombo: 10, perfect: true, itemCount: 10 },
      streak: extended(1, week("none", "none", "none", "none", "none", "active", "active")),
      dailyGoal: { goalXp: 10, before: 0, after: 15, justMet: true },
      node: null,
      heartsGained: 1,
      questsCompleted: [{ code: "daily_goal", title: "Earn 10 XP", rewardGems: 10 }],
      achievementsUnlocked: [],
      recentSessionCount: 3,
      me: { ...ME, hearts: { ...ME.hearts, current: 3 } },
    },
  },
  review: {
    label: "Unit review · one quest",
    completion: {
      ...GOLDEN_LESSON,
      sessionId: 23,
      xp: { total: 44, lines: [{ reason: "review", amount: 40 }, { reason: "combo", amount: 4 }], boostActive: false },
      stats: { accuracyPercent: 88, durationSeconds: 236, mistakes: 1, bestCombo: 5, perfect: false, itemCount: 8 },
      streak: ALREADY_EXTENDED,
      node: { ...DRINKS, id: 7, kind: "review", title: "Unit 2 review", lessonsCompleted: 1, lessonCount: 1, completedNow: true },
      questsCompleted: [{ code: "lessons_2", title: "Complete 2 lessons", rewardGems: 10 }],
      achievementsUnlocked: [],
    },
  },
  legendary: {
    label: "Legendary challenge passed",
    completion: {
      ...GOLDEN_LESSON,
      sessionId: 24,
      kind: "legendary",
      xp: { total: 43, lines: [{ reason: "legendary", amount: 40 }, { reason: "combo", amount: 3 }], boostActive: false },
      stats: { accuracyPercent: 92, durationSeconds: 318, mistakes: 1, bestCombo: 6, perfect: false, itemCount: 12 },
      streak: ALREADY_EXTENDED,
      node: { ...DRINKS, id: 2, title: "Greetings", lessonsCompleted: 3, lessonCount: 3, legendaryNow: true },
      achievementsUnlocked: [],
    },
  },
  boost: {
    label: "XP Boost (2X) · Sage",
    completion: {
      ...GOLDEN_LESSON,
      sessionId: 25,
      xp: {
        total: 30,
        lines: [
          { reason: "lesson", amount: 10 },
          { reason: "combo", amount: 5 },
          { reason: "boost", amount: 15 },
        ],
        boostActive: true,
      },
      streak: ALREADY_EXTENDED,
      achievementsUnlocked: [
        { code: "sage", name: "Sage", level: 2, threshold: 250, description: "Earn 250 XP", color: "#1CB0F6" },
      ],
      me: { ...ME, xpBoost: { active: true, endsAt: "2026-10-08T12:12:00Z", multiplier: 2 } },
    },
  },
  quests: {
    label: "Two quests at once",
    completion: {
      ...GOLDEN_LESSON,
      sessionId: 26,
      streak: ALREADY_EXTENDED,
      questsCompleted: [
        { code: "perfect_1", title: "Complete 1 perfect lesson", rewardGems: 10 },
        { code: "combo_20", title: "Earn 20 Combo Bonus XP", rewardGems: 15 },
      ],
      achievementsUnlocked: [],
    },
  },
  timed: {
    label: "Timed practice · day 10",
    completion: {
      ...GOLDEN_LESSON,
      sessionId: 15,
      kind: "timed",
      xp: { total: 12, lines: [{ reason: "timed", amount: 12 }], boostActive: false },
      stats: { accuracyPercent: 80, durationSeconds: 75, mistakes: 3, bestCombo: 7, perfect: false, itemCount: 20 },
      streak: extended(9, week("active", "active", "active", "active", "active", "active", "active")),
      node: null,
      achievementsUnlocked: [],
      league: null,
      timed: { correct: 12, answered: 15, timeUp: true },
    },
  },
  timedZero: {
    label: "Timed practice · time's up",
    completion: {
      ...GOLDEN_LESSON,
      sessionId: 16,
      kind: "timed",
      xp: { total: 0, lines: [], boostActive: false },
      stats: { accuracyPercent: 0, durationSeconds: 30, mistakes: 2, bestCombo: 0, perfect: false, itemCount: 20 },
      streak: ALREADY_EXTENDED,
      node: null,
      achievementsUnlocked: [],
      league: null,
      timed: { correct: 0, answered: 2, timeUp: true },
    },
  },
  unlocks: {
    label: "10th session · new streak · two achievements",
    completion: {
      ...GOLDEN_LESSON,
      sessionId: 10,
      streak: extended(0, week("active", "active", "none", "none", "none", "none", "active")),
      achievementsUnlocked: [
        {
          code: "sharpshooter",
          name: "Sharpshooter",
          level: 1,
          threshold: 1,
          description: "Complete 1 lesson with no mistakes",
          color: "#FF4B4B",
        },
        {
          code: "champion",
          name: "Champion",
          level: 1,
          threshold: 1,
          description: "Unlock Leaderboards by completing 10 lessons",
          color: "#58CC02",
        },
      ],
      league: { joinedNow: true, league: { tier: 1, name: "Bronze", color: "#D4A880" }, weeklyXp: 15, rankBefore: null, rankAfter: 24 },
      recentSessionCount: 4,
    },
    reviewItems: GOLDEN_ANSWERS,
  },
};

export function isScenarioId(value: string): value is ScenarioId {
  return Object.hasOwn(SCENARIOS, value);
}
