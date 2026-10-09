import type {
  CourseBrief,
  HeartsOut,
  LeagueOut,
  LeagueRowOut,
  LeagueTierOut,
  MeOut,
  PathNodeOut,
  PathOut,
  PathUnitOut,
  QuestOut,
  QuestsOut,
  ShopItemOut,
  ShopOut,
} from "@/lib/api/types";

/*
 * Typed preview data for the leaderboard, quests, shop and practice views, shaped like the API's examples.
 * Deadlines are set relative to the moment the page loads, so countdowns always show sensible values.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const fromNow = (ms: number) => new Date(Date.now() + ms).toISOString();

// ------------------------------------------------------------------------------------------------------- me

const COURSE: CourseBrief = {
  id: 1,
  slug: "es-en",
  title: "Spanish",
  learningLanguage: "es",
  fromLanguage: "en",
  ttsLocale: "es-ES",
  flagKey: "es",
  isPublished: true,
};

function hearts(current: number): HeartsOut {
  const full = current >= 5;
  return {
    current,
    max: 5,
    nextHeartAt: full ? null : fromNow(4 * HOUR),
    fullAt: full ? null : fromNow((4 - current) * 5 * HOUR + 4 * HOUR),
    regenIntervalSeconds: 18000,
    refillPriceGems: 350,
  };
}

function meFixture({ heartsLeft = 4, gems = 820, earnedXp = 12 } = {}): MeOut {
  return {
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
    course: COURSE,
    serverNow: fromNow(0),
    localDate: "2026-10-08",
    xp: { total: 373, today: earnedXp, thisWeek: 42 },
    gems,
    hearts: hearts(heartsLeft),
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
    dailyGoal: { goalXp: 20, earnedXp, met: earnedXp >= 20 },
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
      weekEndsAt: fromNow(3 * DAY + 5 * HOUR),
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
}

// --------------------------------------------------------------------------------------------------- league

/** The ten tiers: name, badge colour, how many advance and how many drop. */
const LEAGUES = [
  ["Bronze", "#D4A880", 20, 0],
  ["Silver", "#C9D6E2", 15, 7],
  ["Gold", "#FCD440", 10, 7],
  ["Sapphire", "#34B8F4", 7, 7],
  ["Ruby", "#FC6060", 7, 7],
  ["Emerald", "#88CC1C", 7, 7],
  ["Amethyst", "#CE82FF", 7, 7],
  ["Pearl", "#FFAADE", 7, 7],
  ["Obsidian", "#4B4B57", 5, 7],
  ["Diamond", "#38D0D0", 0, 5],
] as const;

/** The learner's 29 cohort mates, strongest first: name, avatar colour, weekly XP and streak. */
const RIVALS: readonly (readonly [string, string, number, number])[] = [
  ["Kenji T.", "#FF9600", 512, 402],
  ["Priya S.", "#FF4B4B", 468, 287],
  ["Hiroshi T.", "#FF9600", 431, 356],
  ["Kwame A.", "#FF9600", 389, 231],
  ["Olivia P.", "#00CD9C", 352, 176],
  ["Ingrid L.", "#2B70C9", 318, 141],
  ["Chloé D.", "#FF86D0", 290, 203],
  ["Mateo R.", "#1CB0F6", 264, 158],
  ["Fatima Z.", "#2B70C9", 241, 132],
  ["Mei L.", "#CE82FF", 219, 96],
  ["Arjun M.", "#CE82FF", 197, 73],
  ["Lucía M.", "#CE82FF", 176, 61],
  ["Amara O.", "#00CD9C", 158, 44],
  ["Aisha K.", "#1CB0F6", 140, 37],
  ["Ravi K.", "#2B70C9", 121, 68],
  ["Hana K.", "#CE82FF", 96, 30],
  ["Jonas W.", "#FF4B4B", 38, 51],
  ["Ji-woo P.", "#FF9600", 33, 27],
  ["Yuki S.", "#00CD9C", 29, 22],
  ["Diego R.", "#58CC02", 24, 25],
  ["Liam O.", "#FF4B4B", 20, 19],
  ["Sven J.", "#CE82FF", 17, 14],
  ["Kofi B.", "#58CC02", 12, 21],
  ["Lukas B.", "#2B70C9", 9, 12],
  ["Sofía N.", "#58CC02", 6, 15],
  ["Thandiwe M.", "#FF86D0", 4, 10],
  ["Noor A.", "#FF86D0", 2, 8],
  ["Elena V.", "#FF9600", 1, 6],
  ["Ana P.", "#58CC02", 0, 3],
];

/** A full cohort with the learner at `myRank`, zones drawn from the tier's promotion and demotion counts. */
function cohort(tier: number, myRank: number): LeagueRowOut[] {
  const [, , promote, demote] = LEAGUES[tier - 1];
  const rivals = RIVALS.map(([displayName, avatarColor, xp, streak], index) => ({
    userId: 100 + index,
    displayName,
    avatarColor,
    xp,
    streak,
    isMe: false,
  }));
  const below = rivals[myRank - 1]?.xp ?? 0;
  const above = rivals[myRank - 2]?.xp ?? below + 40;
  const me = { userId: 1, displayName: "Alex", avatarColor: "#1CB0F6", xp: Math.floor((above + below) / 2), streak: 13, isMe: true };
  const ordered = [...rivals.slice(0, myRank - 1), me, ...rivals.slice(myRank - 1)];
  return ordered.map((row, index) => {
    const rank = index + 1;
    const zone = rank <= promote ? "promotion" : rank > ordered.length - demote ? "demotion" : "safe";
    return { ...row, rank, zone };
  });
}

function tiers(highest: number): LeagueTierOut[] {
  return LEAGUES.map(([name, color], index) => ({ tier: index + 1, name, color, reached: index + 1 <= highest }));
}

interface LeagueFixtureOptions {
  tier?: number;
  myRank?: number;
  unlocked?: boolean;
  joined?: boolean;
  lessonsToUnlock?: number;
  endsInMs?: number;
}

function leagueFixture({
  tier = 2,
  myRank = 17,
  unlocked = true,
  joined = true,
  lessonsToUnlock = 0,
  endsInMs = 3 * DAY + 5 * HOUR,
}: LeagueFixtureOptions = {}): LeagueOut {
  const [name, color, promoteCount, demoteCount] = LEAGUES[tier - 1];
  const competing = unlocked && joined;
  return {
    unlocked,
    lessonsToUnlock,
    joined: competing,
    league: { tier, name, color },
    tiers: tiers(tier),
    weekStart: "2026-10-05",
    weekEndsAt: fromNow(endsInMs),
    serverNow: fromNow(0),
    promoteCount,
    demoteCount,
    cohortSize: 30,
    rows: competing ? cohort(tier, myRank) : [],
    lastWeekResult: null,
  };
}

export const LEAGUE_STATES = {
  safe: leagueFixture(),
  promotion: leagueFixture({ myRank: 6 }),
  demotion: leagueFixture({ myRank: 27, endsInMs: 9 * HOUR }),
  bronze: leagueFixture({ tier: 1, myRank: 22, endsInMs: 40 * MINUTE }),
  diamond: leagueFixture({ tier: 10, myRank: 2, endsInMs: 6 * DAY }),
  "not-joined": leagueFixture({ joined: false }),
  locked: leagueFixture({ tier: 1, unlocked: false, lessonsToUnlock: 6 }),
} satisfies Record<string, LeagueOut>;

// --------------------------------------------------------------------------------------------------- quests

const QUESTS: readonly Omit<QuestOut, "progress" | "completed">[] = [
  { code: "daily_goal", slot: 1, title: "Earn 20 XP", icon: "bolt", target: 20, rewardGems: 10 },
  { code: "combo_10", slot: 2, title: "Earn 10 Combo Bonus XP", icon: "flame", target: 10, rewardGems: 10 },
  { code: "perfect_3", slot: 3, title: "Complete 3 perfect lessons", icon: "target", target: 3, rewardGems: 15 },
];

/** Today's quests with the given progress on each, capped at its target as the server does. */
function questsFixture(progress: readonly [number, number, number]): QuestsOut {
  const quests = QUESTS.map((quest, index) => {
    const done = Math.min(progress[index], quest.target);
    return { ...quest, progress: done, completed: done >= quest.target };
  });
  return {
    localDate: "2026-10-08",
    resetsAt: fromNow(12 * HOUR + 20 * MINUTE),
    serverNow: fromNow(0),
    completedCount: quests.filter((quest) => quest.completed).length,
    quests,
  };
}

export const QUEST_STATES = {
  fresh: { quests: questsFixture([0, 0, 0]), me: meFixture({ earnedXp: 0 }) },
  started: { quests: questsFixture([12, 4, 1]), me: meFixture({ earnedXp: 12 }) },
  "goal-met": { quests: questsFixture([20, 10, 1]), me: meFixture({ earnedXp: 26 }) },
  "all-done": { quests: questsFixture([20, 10, 3]), me: meFixture({ earnedXp: 47 }) },
};

// ----------------------------------------------------------------------------------------------------- shop

const NO_EXTRAS = { durationMinutes: null, owned: null, maxOwned: null, activeUntil: null, available: true, unavailableReason: null };

const REFILL: ShopItemOut = {
  ...NO_EXTRAS,
  code: "heart_refill",
  kind: "heart_refill",
  section: "hearts",
  name: "Refill Hearts",
  description: "Get full hearts so you can worry less about making mistakes in a lesson",
  priceGems: 350,
};

const UNLIMITED: ShopItemOut = {
  ...NO_EXTRAS,
  code: "unlimited_hearts",
  kind: "super",
  section: "hearts",
  name: "Unlimited Hearts",
  description: "Never run out of hearts with Super!",
  priceGems: 0,
  available: false,
  unavailableReason: "ITEM_UNAVAILABLE",
};

const FREEZE: ShopItemOut = {
  ...NO_EXTRAS,
  code: "streak_freeze",
  kind: "streak_freeze",
  section: "power_ups",
  name: "Streak Freeze",
  description: "Streak Freeze allows your streak to remain in place for one full day of inactivity.",
  priceGems: 200,
  owned: 1,
  maxOwned: 2,
};

const BOOST: ShopItemOut = {
  ...NO_EXTRAS,
  code: "xp_boost_15",
  kind: "xp_boost",
  section: "power_ups",
  name: "XP Boost",
  description: "Double your XP in lessons for the next 15 minutes.",
  priceGems: 100,
  durationMinutes: 15,
};

/** The item as seen by a learner who cannot afford it; other reasons the server gave are kept. */
function unaffordable(item: ShopItemOut): ShopItemOut {
  return item.available ? { ...item, available: false, unavailableReason: "INSUFFICIENT_GEMS" } : item;
}

export const SHOP_STATES = {
  default: { gems: 820, items: [REFILL, UNLIMITED, FREEZE, BOOST] },
  maxed: {
    gems: 505,
    items: [
      { ...REFILL, available: false, unavailableReason: "HEARTS_ALREADY_FULL" },
      UNLIMITED,
      { ...FREEZE, owned: 2, available: false, unavailableReason: "MAX_FREEZES_EQUIPPED" },
      { ...BOOST, activeUntil: fromNow(12 * MINUTE + 20_000) },
    ],
  },
  broke: { gems: 40, items: [REFILL, UNLIMITED, FREEZE, BOOST].map(unaffordable) },
} satisfies Record<string, ShopOut>;

// ----------------------------------------------------------------------------------------------------- path

type NodeSeed = Pick<PathNodeOut, "id" | "kind" | "title" | "state"> & Partial<PathNodeOut>;

/** A node with its counters and actions worked out from its state, as the server does. */
function pathNode(seed: NodeSeed, index: number): PathNodeOut {
  const lessonCount = seed.lessonCount ?? (seed.kind === "skill" ? 3 : seed.kind === "review" ? 1 : 0);
  const finished = seed.state === "completed" || seed.state === "legendary";
  const playable = seed.kind !== "chest";
  return {
    position: index + 1,
    crownLevel: !playable || !finished ? 0 : seed.state === "legendary" ? 2 : 1,
    lessonsCompleted: finished && playable ? lessonCount : 0,
    lessonCount,
    nextLessonNumber: null,
    chestGems: playable ? null : 20,
    ...seed,
    actions: {
      canStart: seed.state === "active",
      startXp: seed.state !== "active" ? null : seed.kind === "review" ? 40 : 10,
      canPractice: playable && finished,
      practiceXp: 5,
      canLegendary: seed.kind === "skill" && seed.state === "completed",
      legendaryXp: 40,
      legendaryPriceGems: 100,
    },
  };
}

type UnitSeed = Omit<PathUnitOut, "section" | "hasGuidebook" | "nodes"> & { nodes: NodeSeed[] };

function pathUnit({ nodes, ...unit }: UnitSeed): PathUnitOut {
  return { ...unit, section: 1, hasGuidebook: true, nodes: nodes.map(pathNode) };
}

/** The sample learner's path half-way through Unit 2, or a brand-new learner's. */
function pathFixture(progressed: boolean): PathOut {
  const reached = (state: NodeSeed["state"]) => (progressed ? state : "locked");
  return {
    course: COURSE,
    currentNodeId: progressed ? 6 : 1,
    units: [
      pathUnit({
        id: 1,
        number: 1,
        title: "Greet people and introduce yourself",
        description: "Say hello and introduce yourself",
        color: "green",
        state: progressed ? "completed" : "in_progress",
        nodes: [
          { id: 1, kind: "skill", title: "Say hello", state: progressed ? "legendary" : "active" },
          { id: 2, kind: "skill", title: "Introduce yourself", state: reached("completed") },
          { id: 3, kind: "chest", title: "Treasure chest", state: reached("completed") },
          { id: 4, kind: "review", title: "Unit 1 review", state: reached("completed") },
        ],
      }),
      pathUnit({
        id: 2,
        number: 2,
        title: "Order food and drinks",
        description: "Order at a café",
        color: "purple",
        state: progressed ? "in_progress" : "locked",
        nodes: [
          { id: 5, kind: "skill", title: "Food", state: reached("completed") },
          progressed
            ? { id: 6, kind: "skill", title: "Drinks", state: "active", lessonsCompleted: 1, nextLessonNumber: 2 }
            : { id: 6, kind: "skill", title: "Drinks", state: "locked" },
          { id: 7, kind: "chest", title: "Treasure chest", state: "locked" },
          { id: 8, kind: "review", title: "Unit 2 review", state: "locked" },
        ],
      }),
      pathUnit({
        id: 3,
        number: 3,
        title: "Talk about your family",
        description: "Describe the people you love",
        color: "teal",
        state: "locked",
        nodes: [
          { id: 9, kind: "skill", title: "Family", state: "locked", lessonCount: 2 },
          { id: 10, kind: "skill", title: "Describe people", state: "locked", lessonCount: 2 },
          { id: 11, kind: "review", title: "Unit 3 review", state: "locked" },
        ],
      }),
    ],
  };
}

export const PRACTICE_STATES = {
  default: { me: meFixture(), path: pathFixture(true) },
  "full-hearts": { me: meFixture({ heartsLeft: 5 }), path: pathFixture(true) },
  "few-gems": { me: meFixture({ heartsLeft: 2, gems: 60 }), path: pathFixture(true) },
  "new-learner": { me: meFixture({ heartsLeft: 5, earnedXp: 0 }), path: pathFixture(false) },
};
