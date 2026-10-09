import type { ActivityDayOut, ActivityOut, CoursesOut, DayState, LeagueResultOut, MeOut, QuestsOut } from "@/lib/api/types";

const HOUR_MS = 3_600_000;

/** An instant some hours after the preview loaded, so the previews' countdowns always have time left. */
function hoursFromNow(hours: number): string {
  return new Date(Date.now() + hours * HOUR_MS).toISOString();
}

/** Last week's result, waiting to be seen: promoted from Bronze to Silver. */
export const LEAGUE_RESULT: LeagueResultOut = {
  membershipId: 31,
  weekStart: "2026-09-28",
  league: { tier: 1, name: "Bronze", color: "#D4A880" },
  finalRank: 6,
  finalXp: 112,
  outcome: "promoted",
  newLeague: { tier: 2, name: "Silver", color: "#C9D6E2" },
  seen: false,
};

/** The seeded learner as `GET /me` returns it on the demo's first morning. */
export const ME: MeOut = {
  user: {
    id: 1,
    username: "alex",
    displayName: "Alex",
    avatarColor: "#1CB0F6",
    timezone: "Asia/Kolkata",
    timezoneConfirmed: true,
    joinedAt: "2026-09-08T06:30:00Z",
    email: null,
    isDemo: true,
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
  localDate: "2026-10-08",
  xp: { total: 373, today: 0, thisWeek: 42 },
  gems: 820,
  hearts: {
    current: 4,
    max: 5,
    nextHeartAt: hoursFromNow(4),
    fullAt: hoursFromNow(4),
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
    weekEndsAt: hoursFromNow(3.5 * 24),
  },
  xpBoost: { active: false, endsAt: null, multiplier: 2 },
  activeSession: null,
  pendingLeagueResult: LEAGUE_RESULT,
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

/** Named learner states for the previews, each a variation of the seeded learner. */
export const ME_VARIANTS = {
  seeded: ME,
  /** After the first lesson of the day: streak extended, goal met, a quest paid out. */
  extended: {
    ...ME,
    xp: { total: 398, today: 25, thisWeek: 67 },
    gems: 830,
    streak: { ...ME.streak, current: 14, longest: 14, status: "extended", extendedToday: true, nextMilestone: 30 },
    dailyGoal: { goalXp: 20, earnedXp: 25, met: true },
    league: { ...ME.league, rank: 2, zone: "promotion", weeklyXp: 67, xpToPassNext: 31 },
  },
  /** No hearts left, a freeze used yesterday and the clock pushed a day ahead. */
  outOfHearts: {
    ...ME,
    gems: 0,
    hearts: { ...ME.hearts, current: 0, nextHeartAt: hoursFromNow(0.7), fullAt: hoursFromNow(20.7) },
    streak: { ...ME.streak, frozenYesterday: true, freezesEquipped: 0 },
    league: { ...ME.league, rank: 22, xpToPassNext: 4 },
    dev: { enabled: true, clockOffsetSeconds: 29 * 3600 },
  },
  /** A new learner: leaderboards still locked, no streak. */
  newcomer: {
    ...ME,
    xp: { total: 25, today: 0, thisWeek: 25 },
    gems: 500,
    hearts: { ...ME.hearts, current: 5, nextHeartAt: null, fullAt: null },
    streak: { ...ME.streak, current: 0, longest: 2, status: "inactive", freezesEquipped: 0 },
    league: { ...ME.league, unlocked: false, lessonsToUnlock: 7, joinedThisWeek: false, rank: null, zone: null, xpToPassNext: null },
    pendingLeagueResult: null,
  },
  /** Leaderboards unlocked, but no lesson yet this week. */
  notJoined: {
    ...ME,
    league: { ...ME.league, joinedThisWeek: false, rank: null, zone: null, weeklyXp: 0, xpToPassNext: null },
  },
  /** A signed-in account rather than the shared demo learner: no guest card, LOG OUT in the MORE menu. */
  account: {
    ...ME,
    user: { ...ME.user, id: 77, username: "ana", displayName: "Ana", email: "ana@example.com", isDemo: false },
  },
} satisfies Record<string, MeOut>;

export type MeVariant = keyof typeof ME_VARIANTS;

export const QUESTS: QuestsOut = {
  localDate: "2026-10-08",
  resetsAt: "2026-10-08T18:30:00Z",
  serverNow: "2026-10-08T12:00:00Z",
  completedCount: 0,
  quests: [
    { code: "daily_goal", slot: 1, title: "Earn 20 XP", icon: "bolt", progress: 0, target: 20, rewardGems: 10, completed: false },
    { code: "combo_10", slot: 2, title: "Earn 10 Combo Bonus XP", icon: "flame", progress: 4, target: 10, rewardGems: 10, completed: false },
    { code: "perfect_3", slot: 3, title: "Complete 3 perfect lessons", icon: "target", progress: 1, target: 3, rewardGems: 15, completed: false },
  ],
};

export const QUESTS_DONE: QuestsOut = {
  ...QUESTS,
  completedCount: 3,
  quests: QUESTS.quests.map((quest) => ({ ...quest, progress: quest.target, completed: true })),
};

export const COURSES: CoursesOut = {
  items: [
    { id: 1, slug: "es-en", title: "Spanish", learningLanguage: "es", fromLanguage: "en", ttsLocale: "es-ES", flagKey: "es", isPublished: true },
    { id: 2, slug: "fr-en", title: "French", learningLanguage: "fr", fromLanguage: "en", ttsLocale: "fr-FR", flagKey: "fr", isPublished: false },
    { id: 3, slug: "de-en", title: "German", learningLanguage: "de", fromLanguage: "en", ttsLocale: "de-DE", flagKey: "de", isPublished: false },
  ],
};

function activityDay(date: string, state: DayState): ActivityDayOut {
  const xp = state === "active" ? 15 : 0;
  return { date, xp, goalXp: state === "active" ? 20 : null, goalMet: false, state };
}

/** The seeded streak: 13 days up to yesterday, with a Streak Freeze on October 2; nothing yet today. */
export const ACTIVITY_OCTOBER: ActivityOut = {
  from: "2026-09-30",
  to: "2026-10-08",
  today: "2026-10-08",
  items: [
    activityDay("2026-09-30", "active"),
    activityDay("2026-10-01", "active"),
    activityDay("2026-10-02", "frozen"),
    activityDay("2026-10-03", "active"),
    activityDay("2026-10-04", "active"),
    activityDay("2026-10-05", "active"),
    activityDay("2026-10-06", "active"),
    activityDay("2026-10-07", "active"),
    activityDay("2026-10-08", "none"),
  ],
};

/** October once today's lesson is done: today joins the run. */
export const ACTIVITY_OCTOBER_EXTENDED: ActivityOut = {
  ...ACTIVITY_OCTOBER,
  items: ACTIVITY_OCTOBER.items.map((day) => (day.date === "2026-10-08" ? activityDay(day.date, "active") : day)),
};

/** September: an older 10-day run, a break, then the current run from the 24th. */
export const ACTIVITY_SEPTEMBER: ActivityOut = {
  from: "2026-08-31",
  to: "2026-09-30",
  today: "2026-10-08",
  items: Array.from({ length: 31 }, (_, index) => {
    // Index 0 is August 31, so index n is September n.
    const date = new Date(Date.UTC(2026, 7, 31 + index)).toISOString().slice(0, 10);
    const active = (index >= 9 && index <= 18) || index >= 24;
    return activityDay(date, active ? "active" : "none");
  }),
};
