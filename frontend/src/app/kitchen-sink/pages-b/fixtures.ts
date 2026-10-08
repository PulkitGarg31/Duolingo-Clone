import type {
  AchievementOut,
  ActivityDayOut,
  ClockOut,
  GuidebookOut,
  MeOut,
  ProfileOut,
  SettingsOut,
} from "@/lib/api/types";

/*
 * The seeded demo at 2026-10-08 12:00 UTC (the learner in Asia/Kolkata), as the API returns it. Preview data
 * for the profile, settings and guidebook views; nothing here is fetched.
 */

export const TODAY = "2026-10-08";

export const settings: SettingsOut = {
  dailyGoalXp: 20,
  theme: "system",
  soundEffects: true,
  animations: true,
  motivationalMessages: true,
  listeningExercises: true,
  timezone: "Asia/Kolkata",
};

export const me: MeOut = {
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
  serverNow: "2026-10-08T12:00:00Z",
  localDate: TODAY,
  xp: { total: 373, today: 0, thisWeek: 42 },
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
    current: 13,
    longest: 13,
    status: "at_risk",
    extendedToday: false,
    frozenYesterday: false,
    freezesEquipped: 1,
    maxFreezes: 2,
    nextMilestone: 14,
  },
  dailyGoal: { goalXp: 20, earnedXp: 0, met: false },
  league: {
    unlocked: true,
    lessonsToUnlock: 0,
    tier: 2,
    name: "Silver",
    color: "#C9D6E2",
    joinedThisWeek: true,
    rank: 17,
    weeklyXp: 42,
    zone: "safe",
    xpToPassNext: 9,
    cohortSize: 30,
    promoteCount: 15,
    demoteCount: 7,
    weekEndsAt: "2026-10-12T00:00:00Z",
  },
  xpBoost: { active: false, endsAt: null, multiplier: 2 },
  activeSession: null,
  pendingLeagueResult: null,
  settings,
  dev: { enabled: true, clockOffsetSeconds: 0 },
};

const UNLOCKED = "2026-10-08T11:58:43Z";

function tiers(thresholds: readonly number[], earned: number) {
  return thresholds.map((threshold, index) => ({
    level: index + 1,
    threshold,
    unlockedAt: index < earned ? UNLOCKED : null,
  }));
}

const learnerAchievements: AchievementOut[] = [
  {
    code: "wildfire",
    name: "Wildfire",
    color: "#FF9600",
    level: 2,
    maxLevel: 10,
    currentValue: 13,
    nextThreshold: 14,
    description: "Reach a 14 day streak",
    tiers: tiers([3, 7, 14], 2),
  },
  {
    code: "sage",
    name: "Sage",
    color: "#1CB0F6",
    level: 2,
    maxLevel: 10,
    currentValue: 373,
    nextThreshold: 500,
    description: "Earn 500 XP",
    tiers: tiers([100, 250, 500], 2),
  },
  {
    code: "scholar",
    name: "Scholar",
    color: "#CE82FF",
    level: 0,
    maxLevel: 10,
    currentValue: 31,
    nextThreshold: 50,
    description: "Learn 50 new words in a single course",
    tiers: tiers([50], 0),
  },
  {
    code: "sharpshooter",
    name: "Sharpshooter",
    color: "#FF4B4B",
    level: 2,
    maxLevel: 5,
    currentValue: 5,
    nextThreshold: 20,
    description: "Complete 20 lessons with no mistakes",
    tiers: tiers([1, 5, 20], 2),
  },
  {
    code: "champion",
    name: "Champion",
    color: "#58CC02",
    level: 2,
    maxLevel: 10,
    currentValue: 2,
    nextThreshold: 3,
    description: "Advance to the Gold League",
    tiers: tiers([1, 2, 3], 2),
  },
  {
    code: "winner",
    name: "Winner",
    color: "#FFC800",
    level: 0,
    maxLevel: 1,
    currentValue: 0,
    nextThreshold: 1,
    description: "Finish #1 in the leaderboard",
    tiers: tiers([1], 0),
  },
  {
    code: "legendary",
    name: "Legendary",
    color: "#38D0D0",
    level: 0,
    maxLevel: 1,
    currentValue: 0,
    nextThreshold: 1,
    description: "Finish #1 in the Diamond League",
    tiers: tiers([1], 0),
  },
];

export const learnerProfile: ProfileOut = {
  user: {
    id: 1,
    username: "alex",
    displayName: "Alex",
    avatarColor: "#1CB0F6",
    joinedAt: "2026-09-08T06:30:00Z",
    isMe: true,
    isBot: false,
  },
  stats: {
    currentStreak: 13,
    longestStreak: 13,
    totalXp: 373,
    league: { tier: 2, name: "Silver", color: "#C9D6E2" },
    topThreeFinishes: 0,
    wordsLearned: 31,
    lessonsCompleted: 11,
    crowns: 5,
  },
  achievements: learnerAchievements,
};

/** A leaderboard bot: long streak, a first place last week, maxed Wildfire and Winner. */
export const botProfile: ProfileOut = {
  user: {
    id: 24,
    username: "kenji_t",
    displayName: "Kenji T.",
    avatarColor: "#FF9600",
    joinedAt: "2025-03-14T09:00:00Z",
    isMe: false,
    isBot: true,
  },
  stats: {
    currentStreak: 402,
    longestStreak: 402,
    totalXp: 25412,
    league: { tier: 2, name: "Silver", color: "#C9D6E2" },
    topThreeFinishes: 1,
    wordsLearned: null,
    lessonsCompleted: null,
    crowns: null,
  },
  achievements: learnerAchievements.map((achievement): AchievementOut => {
    switch (achievement.code) {
      case "wildfire":
        return {
          ...achievement,
          level: 10,
          currentValue: 402,
          nextThreshold: null,
          description: "Reach a 365 day streak",
          tiers: tiers([3, 7, 14, 30, 50, 75, 125, 180, 250, 365], 0),
        };
      case "sage":
        return { ...achievement, level: 9, currentValue: 25412, nextThreshold: 30000, description: "Earn 30000 XP", tiers: [] };
      case "winner":
        return { ...achievement, level: 1, currentValue: 1, nextThreshold: null, tiers: tiers([1], 0) };
      case "scholar":
      case "sharpshooter":
        return { ...achievement, level: 0, currentValue: 0 };
      default:
        return achievement;
    }
  }),
};

/**
 * The learner's days from `from` on, one character per day: "a" practiced, "g" practiced and met the goal,
 * "f" covered by a Streak Freeze, "." nothing.
 */
function history(from: string, days: string, xp: readonly number[]): ActivityDayOut[] {
  const start = Date.parse(`${from}T00:00:00Z`);
  return [...days].map((code, index): ActivityDayOut => {
    const date = new Date(start + index * 86_400_000).toISOString().slice(0, 10);
    const active = code === "a" || code === "g";
    return {
      date,
      xp: active ? (xp[index] ?? 15) : 0,
      goalXp: active ? 20 : null,
      goalMet: code === "g",
      state: active ? "active" : code === "f" ? "frozen" : "none",
    };
  });
}

/** 2026-08-31 to today: the old 10-day streak, the gap that ended it, then the current 13-day run. */
export const activity: ActivityDayOut[] = history(
  "2026-08-31",
  "........aaaaaaaaaa......gaaaaaaafgaaaa.",
  [
    ...Array<number>(8).fill(0),
    15, 14, 15, 15, 14, 13, 15, 10, 14, 10,
    ...Array<number>(6).fill(0),
    44, 15, 15, 10, 15, 14, 10, 15, 0, 43, 15, 14, 15, 13, 0,
  ],
);

export const clock: ClockOut = {
  realNow: "2026-10-08T12:00:00Z",
  offsetSeconds: 104400,
  now: "2026-10-09T17:00:00Z",
  timezone: "Asia/Kolkata",
  localNow: "2026-10-09T22:30:00+05:30",
  localDate: "2026-10-09",
  leagueWeekStart: "2026-10-05",
  leagueWeekEndsAt: "2026-10-12T00:00:00Z",
};

export const guidebook: GuidebookOut = {
  unit: { id: 1, number: 1, title: "Greet people and introduce yourself", color: "green" },
  ttsLocale: "es-ES",
  keyPhrases: [
    { text: "Hola, ¿cómo estás?", translation: "Hello, how are you?" },
    { text: "Muy bien, gracias. ¿Y tú?", translation: "Very well, thank you. And you?" },
    { text: "Buenos días.", translation: "Good morning." },
    { text: "Buenas noches.", translation: "Good night." },
    { text: "¿Cómo te llamas?", translation: "What is your name?" },
    { text: "Me llamo Ana. Mucho gusto.", translation: "My name is Ana. Nice to meet you." },
  ],
  tipsMd: [
    "## Questions and exclamations",
    "",
    "Spanish opens every question with **¿** and every exclamation with **¡**, then closes them the way English does.",
    "",
    "- **¿Cómo estás?** How are you?",
    "- **¡Hola, Ana!** Hello, Ana!",
    "",
    "> You never have to type ¿ or ¡ in an answer. Punctuation doesn't count against you.",
    "",
    "## Tú and usted",
    "",
    'Spanish has two ways to say "you" to one person. Use **tú** with friends, family and children. Use **usted** with people you don\'t know well, or when you want to sound polite.',
    "",
    "- **¿Cómo estás?** How are you? (to a friend)",
    "- **¿Cómo está usted?** How are you? (polite)",
    "",
    "This course practices the friendly **tú**.",
  ].join("\n"),
};

export const purpleGuidebook: GuidebookOut = {
  unit: { id: 2, number: 2, title: "Order food and drinks", color: "purple" },
  ttsLocale: "es-ES",
  keyPhrases: [
    { text: "Quiero un café, por favor.", translation: "I want a coffee, please." },
    { text: "¿Cuánto cuesta?", translation: "How much does it cost?" },
  ],
  tipsMd: "## Nouns have gender\nSpanish nouns are masculine (**el** pan) or feminine (**la** leche).",
};
