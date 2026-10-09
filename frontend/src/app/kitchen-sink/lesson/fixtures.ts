import type {
  CompletionOut,
  ExerciseOut,
  FillBlankExercise,
  HeartsOut,
  MatchPairsExercise,
  MeOut,
  MultipleChoiceExercise,
  SessionItemOut,
  SessionKind,
  SessionOut,
  TranslateExercise,
  TypeAnswerExercise,
} from "@/lib/api/types";

/*
 * Preview data for the lesson player, shaped exactly like the API's answers (the "Drinks" lesson of the
 * seeded course). Nothing here is fetched.
 */

const SPECIAL = ["á", "é", "í", "ó", "ú", "ñ", "ü", "¿", "¡"];

export const HEARTS: HeartsOut = {
  current: 4,
  max: 5,
  nextHeartAt: "2026-10-08T16:00:00Z",
  fullAt: "2026-10-08T16:00:00Z",
  regenIntervalSeconds: 18000,
  refillPriceGems: 350,
};

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
  hearts: HEARTS,
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
  activeSession: { id: 14, kind: "lesson", nodeId: 6 },
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

// ------------------------------------------------------------------------------------------------ exercises

export const PICTURES: MultipleChoiceExercise = {
  id: 69,
  type: "multiple_choice",
  instruction: "Which one of these is “the juice”?",
  prompt: null,
  layout: "pictures",
  options: [
    { id: 301, text: "el agua", imageKey: "water" },
    { id: 302, text: "el jugo", imageKey: "juice" },
    { id: 303, text: "la leche", imageKey: "milk" },
  ],
};

export const TRANSLATE_TO_ENGLISH: TranslateExercise = {
  id: 70,
  type: "translate",
  instruction: "Write this in English",
  prompt: {
    text: "Yo bebo agua.",
    language: "es",
    speak: true,
    segments: [
      { text: "Yo", hint: "I" },
      { text: " ", hint: null },
      { text: "bebo", hint: "drink, I drink" },
      { text: " ", hint: null },
      { text: "agua", hint: "water" },
      { text: ".", hint: null },
    ],
  },
  answerLanguage: "en",
  tiles: [
    { id: 311, text: "water" },
    { id: 312, text: "milk" },
    { id: 313, text: "I" },
    { id: 314, text: "eat" },
    { id: 315, text: "drink" },
    { id: 316, text: "you" },
  ],
  specialCharacters: [],
};

export const MATCH: MatchPairsExercise = {
  id: 71,
  type: "match_pairs",
  instruction: "Tap the matching pairs",
  left: [
    { id: 41, text: "el té" },
    { id: 42, text: "el agua" },
    { id: 43, text: "la leche" },
    { id: 44, text: "el café" },
  ],
  right: [
    { id: 43, text: "the milk" },
    { id: 41, text: "the tea" },
    { id: 44, text: "the coffee" },
    { id: 42, text: "the water" },
  ],
};

export const FILL: FillBlankExercise = {
  id: 72,
  type: "fill_blank",
  instruction: "Fill in the blank",
  prompt: {
    text: "Tú ___ agua.",
    language: "es",
    speak: true,
    segments: [
      { text: "Tú", hint: "you" },
      { text: " ___ ", hint: null },
      { text: "agua", hint: "water" },
      { text: ".", hint: null },
    ],
  },
  before: "Tú",
  after: "agua.",
  translation: "You drink water.",
  options: [
    { id: 321, text: "bebo" },
    { id: 322, text: "bebes" },
    { id: 323, text: "beber" },
  ],
};

export const TRANSLATE_TO_SPANISH: TranslateExercise = {
  id: 73,
  type: "translate",
  instruction: "Write this in Spanish",
  prompt: {
    text: "I want a juice, please.",
    language: "en",
    speak: false,
    segments: [{ text: "I want a juice, please.", hint: null }],
  },
  answerLanguage: "es",
  tiles: [
    { id: 331, text: "jugo" },
    { id: 332, text: "favor" },
    { id: 333, text: "Quiero" },
    { id: 334, text: "leche" },
    { id: 335, text: "un" },
    { id: 336, text: "por" },
    { id: 337, text: "una" },
    { id: 338, text: "bebo" },
  ],
  specialCharacters: SPECIAL,
};

export const LISTEN: TypeAnswerExercise = {
  id: 74,
  type: "type_answer",
  instruction: "Type what you hear",
  prompt: { text: "Quiero agua.", language: "es", speak: true, segments: [] },
  audioOnly: true,
  answerLanguage: "es",
  specialCharacters: SPECIAL,
};

export const CHOICE_LIST: MultipleChoiceExercise = {
  id: 75,
  type: "multiple_choice",
  instruction: "Select the correct meaning",
  prompt: {
    text: "Un café con leche, por favor.",
    language: "es",
    speak: true,
    segments: [
      { text: "Un", hint: "a, one" },
      { text: " ", hint: null },
      { text: "café", hint: "coffee" },
      { text: " ", hint: null },
      { text: "con", hint: "with" },
      { text: " ", hint: null },
      { text: "leche", hint: "milk" },
      { text: ", ", hint: null },
      { text: "por favor", hint: "please" },
      { text: ".", hint: null },
    ],
  },
  layout: "list",
  options: [
    { id: 341, text: "A tea with milk, please.", imageKey: null },
    { id: 342, text: "A coffee with milk, please.", imageKey: null },
    { id: 343, text: "A coffee with sugar, please.", imageKey: null },
  ],
};

export const TYPE_SPANISH: TypeAnswerExercise = {
  id: 76,
  type: "type_answer",
  instruction: "Write this in Spanish",
  prompt: { text: "Good night", language: "en", speak: false, segments: [{ text: "Good night", hint: null }] },
  audioOnly: false,
  answerLanguage: "es",
  specialCharacters: SPECIAL,
};

/** What the server accepts, for the in-memory grader: the right option, or the primary answer text. */
export const ANSWER_KEY: Record<number, number | string> = {
  [PICTURES.id]: 302,
  [TRANSLATE_TO_ENGLISH.id]: "I drink water.",
  [FILL.id]: 322,
  [TRANSLATE_TO_SPANISH.id]: "Quiero un jugo, por favor.",
  [LISTEN.id]: "Quiero agua.",
  [CHOICE_LIST.id]: 342,
  [TYPE_SPANISH.id]: "Buenas noches",
};

/** The English meaning shown under a listening sentence. */
export const MEANINGS: Record<number, string> = { [LISTEN.id]: "I want water." };

// ------------------------------------------------------------------------------------------------- sessions

export function item(id: number, seq: number, exercise: ExerciseOut, extra: Partial<SessionItemOut> = {}): SessionItemOut {
  return { id, seq, origin: "initial", label: null, result: null, note: null, exercise, ...extra };
}

const LESSON_EXERCISES: ExerciseOut[] = [
  PICTURES,
  TRANSLATE_TO_ENGLISH,
  MATCH,
  FILL,
  CHOICE_LIST,
  TRANSLATE_TO_SPANISH,
  TYPE_SPANISH,
  LISTEN,
];

const RULES: Record<SessionKind, SessionOut["rules"]> = {
  lesson: { heartsEnabled: true, retryPolicy: "always", hintsEnabled: true, maxMistakes: null },
  practice: { heartsEnabled: false, retryPolicy: "once", hintsEnabled: true, maxMistakes: null },
  legendary: { heartsEnabled: false, retryPolicy: "never", hintsEnabled: false, maxMistakes: 2 },
  timed: { heartsEnabled: false, retryPolicy: "never", hintsEnabled: true, maxMistakes: null },
};

/** Timed practice plans up to 20 items of the fast exercise types (no typing). */
const TIMED_ITEMS = 20;

/** The exercises a session of `kind` plans, as its server-side planner would pick them. */
function plannedExercises(kind: SessionKind): ExerciseOut[] {
  if (kind === "legendary") return LESSON_EXERCISES.filter((exercise) => exercise.type !== "match_pairs");
  if (kind === "timed") {
    const fast = LESSON_EXERCISES.filter((exercise) => exercise.type !== "type_answer");
    return Array.from({ length: TIMED_ITEMS }, (_, index) => fast[index % fast.length]);
  }
  return LESSON_EXERCISES;
}

/** A fresh session of `kind` over the lesson's exercises. */
export function makeSession(kind: SessionKind = "lesson", extra: Partial<SessionOut> = {}): SessionOut {
  const exercises = plannedExercises(kind);
  const items = exercises.map((exercise, index) =>
    item(101 + index, index + 1, exercise, { label: kind === "lesson" && index === 0 ? "new_word" : null }),
  );
  return {
    id: kind === "lesson" ? 14 : 15,
    kind,
    status: "active",
    endReason: null,
    resumed: false,
    node: kind === "timed" ? null : { id: 6, kind: "skill", title: "Drinks", unitId: 2, unitNumber: 2, unitColor: "purple" },
    lesson: kind === "lesson" ? { id: 12, number: 2, count: 3 } : null,
    rules: RULES[kind],
    timer:
      kind === "timed"
        ? {
            startSeconds: 30,
            bonusSeconds: { multiple_choice: 5, match_pairs: 5, fill_blank: 10, translate: 10 },
            expiresAt: new Date(Date.now() + 30_000).toISOString(),
          }
        : null,
    startedAt: "2026-10-08T12:00:05Z",
    serverNow: "2026-10-08T12:00:05Z",
    hearts: HEARTS,
    lives: kind === "legendary" ? { max: 3, left: 3 } : null,
    progress: { completed: 0, total: items.length },
    mistakes: 0,
    combo: 0,
    bestCombo: 0,
    currentItemId: items[0].id,
    blockedReason: null,
    canComplete: false,
    items,
    ...extra,
  };
}

// ----------------------------------------------------------------------------------------------- completion

export const COMPLETION: CompletionOut = {
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
    week: [
      { date: "2026-10-02", state: "frozen" },
      { date: "2026-10-03", state: "active" },
      { date: "2026-10-04", state: "active" },
      { date: "2026-10-05", state: "active" },
      { date: "2026-10-06", state: "active" },
      { date: "2026-10-07", state: "active" },
      { date: "2026-10-08", state: "active" },
    ],
  },
  dailyGoal: { goalXp: 20, before: 0, after: 15, justMet: false },
  node: {
    id: 6,
    kind: "skill",
    title: "Drinks",
    lessonsCompleted: 2,
    lessonCount: 3,
    completedNow: false,
    legendaryNow: false,
    unlockedNodeIds: [],
  },
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
