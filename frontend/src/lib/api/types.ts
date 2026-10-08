// The API contract. Mirrors backend/app/schemas/*. Change both sides together.

export type ISODateTime = string;            // "2026-10-08T12:00:00Z" (UTC, always "Z")
export type ISODate = string;                // "2026-10-08" (learner-local calendar date)

// ---------------- enums ----------------
export type TextLang = "es" | "en";
export type SessionKind = "lesson" | "practice" | "legendary" | "timed";
export type SessionStatus = "active" | "completed" | "failed" | "abandoned";
export type EndReason = "passed" | "quit" | "out_of_hearts" | "too_many_mistakes" | "idle_timeout" | "superseded";
export type NodeKind = "skill" | "chest" | "review";
export type NodeState = "locked" | "active" | "available" | "completed" | "legendary";
export type UnitState = "locked" | "in_progress" | "completed";
export type UnitColor = "green" | "purple" | "teal" | "blue" | "pink" | "orange" | "red" | "magenta" | "brown";
export type ExerciseType = "multiple_choice" | "translate" | "match_pairs" | "fill_blank" | "type_answer";
export type ItemOrigin = "initial" | "retry";
export type ItemLabel = "previous_mistake" | "new_word";
export type ItemResult = "correct" | "incorrect" | "skipped" | "cant_listen";
export type GradeNote = "alternate" | "accent" | "typo" | "missing_word" | "wrong_word";
export type RetryPolicy = "always" | "once" | "never";
export type StreakStatus = "inactive" | "at_risk" | "extended";
export type DayState = "active" | "frozen" | "none";
export type Theme = "system" | "light" | "dark";
export type DailyGoalXp = 10 | 20 | 30 | 50;
export type LeagueZone = "promotion" | "safe" | "demotion";
export type LeagueOutcome = "promoted" | "stayed" | "demoted";
export type XpReason = "lesson" | "review" | "practice" | "legendary" | "timed" | "combo" | "boost";
export type ShopItemCode = "heart_refill" | "unlimited_hearts" | "streak_freeze" | "xp_boost_15";
export type ShopItemKind = "heart_refill" | "super" | "streak_freeze" | "xp_boost";
export type ShopSection = "hearts" | "power_ups";
export type ShopUnavailableReason = "HEARTS_ALREADY_FULL" | "MAX_FREEZES_EQUIPPED" | "INSUFFICIENT_GEMS" | "ITEM_UNAVAILABLE";
export type TimezoneEffect = "none" | "shifted";
export type QuestSlot = 1 | 2 | 3;
export type QuestIcon = "bolt" | "book" | "target" | "flame";
export type AchievementCode = "wildfire" | "sage" | "scholar" | "sharpshooter" | "champion" | "winner" | "legendary";
export type BlockedReason = "OUT_OF_HEARTS";

// ---------------- shared ----------------
export interface HeartsOut {
  current: number; max: number;
  nextHeartAt: ISODateTime | null; fullAt: ISODateTime | null;
  regenIntervalSeconds: number; refillPriceGems: number;
}
export interface LeagueBrief { tier: number; name: string; color: string; }
export interface CourseBrief {
  id: number; slug: string; title: string; learningLanguage: string; fromLanguage: string;
  ttsLocale: string; flagKey: string; isPublished: boolean;
}

// ---------------- system ----------------
export interface HealthOut { status: "ok"; seeded: boolean; bootId: string; bootedAt: ISODateTime; serverTime: ISODateTime; version: string; }

// ---------------- /me ----------------
export interface MeUser {
  id: number; username: string; displayName: string; avatarColor: string;
  timezone: string; timezoneConfirmed: boolean; joinedAt: ISODateTime;
}
export interface MeXp { total: number; today: number; thisWeek: number; }
export interface MeStreak {
  current: number; longest: number; status: StreakStatus; extendedToday: boolean; frozenYesterday: boolean;
  freezesEquipped: number; maxFreezes: number; nextMilestone: number;
}
export interface DailyGoalOut { goalXp: DailyGoalXp; earnedXp: number; met: boolean; }
export interface MeLeague extends LeagueBrief {
  unlocked: boolean; lessonsToUnlock: number; joinedThisWeek: boolean;
  rank: number | null; weeklyXp: number; zone: LeagueZone | null; xpToPassNext: number | null;
  cohortSize: number; promoteCount: number; demoteCount: number; weekEndsAt: ISODateTime;
}
export interface XpBoostOut { active: boolean; endsAt: ISODateTime | null; multiplier: number; }
export interface ActiveSessionRef { id: number; kind: SessionKind; nodeId: number | null; }
export interface LeagueResultOut {
  membershipId: number; weekStart: ISODate; league: LeagueBrief; finalRank: number; finalXp: number;
  outcome: LeagueOutcome; newLeague: LeagueBrief; seen: boolean;
}
export interface SettingsOut {
  dailyGoalXp: DailyGoalXp; theme: Theme; soundEffects: boolean; animations: boolean;
  motivationalMessages: boolean; listeningExercises: boolean; timezone: string;
}
export interface DevInfo { enabled: boolean; clockOffsetSeconds: number; }
export interface MeOut {
  user: MeUser; course: CourseBrief; serverNow: ISODateTime; localDate: ISODate;
  xp: MeXp; gems: number; hearts: HeartsOut; streak: MeStreak; dailyGoal: DailyGoalOut;
  league: MeLeague; xpBoost: XpBoostOut; activeSession: ActiveSessionRef | null;
  pendingLeagueResult: LeagueResultOut | null; settings: SettingsOut; dev: DevInfo | null;
}

export interface SettingsPatchIn {                         // PATCH /me/settings (at least one field)
  dailyGoalXp?: DailyGoalXp; theme?: Theme; soundEffects?: boolean; animations?: boolean;
  motivationalMessages?: boolean; listeningExercises?: boolean; timezone?: string;
}
export interface SettingsUpdateOut extends SettingsOut { timezoneEffect: TimezoneEffect; }

export interface ActivityDayOut { date: ISODate; xp: number; goalXp: DailyGoalXp | null; goalMet: boolean; state: DayState; }
export interface ActivityOut { from: ISODate; to: ISODate; today: ISODate; items: ActivityDayOut[]; }

// ---------------- path & content ----------------
export interface PathNodeActions {
  canStart: boolean; startXp: number | null; canPractice: boolean; practiceXp: number;
  canLegendary: boolean; legendaryXp: number; legendaryPriceGems: number;
}
export interface PathNodeOut {
  id: number; position: number; kind: NodeKind; title: string; state: NodeState; crownLevel: 0 | 1 | 2;
  lessonsCompleted: number; lessonCount: number; nextLessonNumber: number | null; chestGems: number | null;
  actions: PathNodeActions;
}
export interface PathUnitOut {
  id: number; number: number; section: number; title: string; description: string;
  color: UnitColor; state: UnitState; hasGuidebook: boolean; nodes: PathNodeOut[];
}
export interface PathOut { course: CourseBrief; currentNodeId: number | null; units: PathUnitOut[]; }
export interface ChestClaimOut { nodeId: number; gemsAwarded: number; gems: number; replayed: boolean; }
export interface GuidebookOut {
  unit: { id: number; number: number; title: string; color: UnitColor };
  ttsLocale: string; keyPhrases: { text: string; translation: string }[]; tipsMd: string | null;
}
export interface CoursesOut { items: CourseBrief[]; }

// ---------------- league ----------------
export interface LeagueTierOut extends LeagueBrief { reached: boolean; }
export interface LeagueRowOut {
  rank: number; userId: number; displayName: string; avatarColor: string;
  xp: number; streak: number; isMe: boolean; zone: LeagueZone;
}
export interface LeagueOut {
  unlocked: boolean; lessonsToUnlock: number; joined: boolean; league: LeagueBrief; tiers: LeagueTierOut[];
  weekStart: ISODate; weekEndsAt: ISODateTime; serverNow: ISODateTime;
  promoteCount: number; demoteCount: number; cohortSize: number;
  rows: LeagueRowOut[]; lastWeekResult: LeagueResultOut | null;
}
export interface LeagueAckOut { membershipId: number; seenAt: ISODateTime; }

// ---------------- quests ----------------
export interface QuestOut {
  code: string; slot: QuestSlot; title: string; icon: QuestIcon;
  progress: number; target: number; rewardGems: number; completed: boolean;
}
export interface QuestsOut { localDate: ISODate; resetsAt: ISODateTime; serverNow: ISODateTime; completedCount: number; quests: QuestOut[]; }

// ---------------- shop & purchases ----------------
export interface ShopItemOut {
  code: ShopItemCode; kind: ShopItemKind; section: ShopSection; name: string; description: string;
  priceGems: number; durationMinutes: number | null; owned: number | null; maxOwned: number | null;
  activeUntil: ISODateTime | null; available: boolean; unavailableReason: ShopUnavailableReason | null;
}
export interface ShopOut { gems: number; items: ShopItemOut[]; }
export interface PurchaseIn { itemCode: ShopItemCode; }  // + header Idempotency-Key: <uuid>
export interface PurchaseEffect { hearts: HeartsOut; streakFreezes: number; xpBoostUntil: ISODateTime | null; }
export interface PurchaseOut {
  id: number; itemCode: ShopItemCode; priceGems: number; purchasedAt: ISODateTime; replayed: boolean;
  gems: number; effect: PurchaseEffect;
}

// ---------------- profile ----------------
export interface AchievementTierOut { level: number; threshold: number; unlockedAt: ISODateTime | null; }
export interface AchievementOut {
  code: AchievementCode; name: string; color: string; level: number; maxLevel: number;
  currentValue: number; nextThreshold: number | null; description: string; tiers: AchievementTierOut[];
}
export interface ProfileUser { id: number; username: string; displayName: string; avatarColor: string; joinedAt: ISODateTime; isMe: boolean; isBot: boolean; }
export interface ProfileStats {
  currentStreak: number; longestStreak: number; totalXp: number; league: LeagueBrief | null; topThreeFinishes: number;
  wordsLearned: number | null; lessonsCompleted: number | null; crowns: number | null;   // null for bots
}
export interface ProfileOut { user: ProfileUser; stats: ProfileStats; achievements: AchievementOut[]; }

// ---------------- sessions ----------------
export interface StartSessionIn { kind: SessionKind; nodeId?: number | null; }

export interface PromptSegment { text: string; hint: string | null; }
export interface PromptOut { text: string; language: TextLang; speak: boolean; segments: PromptSegment[]; }
export interface ChoiceOptionOut { id: number; text: string; imageKey: string | null; }
export interface TokenOut { id: number; text: string; }

export interface MultipleChoiceExercise {
  id: number; type: "multiple_choice"; instruction: string;
  prompt: PromptOut | null; layout: "pictures" | "list"; options: ChoiceOptionOut[];
}
export interface TranslateExercise {
  id: number; type: "translate"; instruction: string;
  prompt: PromptOut; answerLanguage: TextLang; tiles: TokenOut[]; specialCharacters: string[];
}
export interface MatchPairsExercise {
  id: number; type: "match_pairs"; instruction: string;
  left: TokenOut[]; right: TokenOut[];                   // same id on both sides = a pair
}
export interface FillBlankExercise {
  id: number; type: "fill_blank"; instruction: string;
  prompt: PromptOut; before: string; after: string; translation: string | null; options: TokenOut[];
}
export interface TypeAnswerExercise {
  id: number; type: "type_answer"; instruction: string;
  prompt: PromptOut; audioOnly: boolean; answerLanguage: TextLang; specialCharacters: string[];
}
export type ExerciseOut = MultipleChoiceExercise | TranslateExercise | MatchPairsExercise | FillBlankExercise | TypeAnswerExercise;

export interface SessionItemOut {
  id: number; seq: number; origin: ItemOrigin; label: ItemLabel | null;
  result: ItemResult | null; note: GradeNote | null; exercise: ExerciseOut;
}
export interface SessionNodeRef { id: number; kind: NodeKind; title: string; unitId: number; unitNumber: number; unitColor: UnitColor; }
export interface SessionLessonRef { id: number; number: number; count: number; }
export interface SessionRules { heartsEnabled: boolean; retryPolicy: RetryPolicy; hintsEnabled: boolean; maxMistakes: number | null; }
export interface TimerOut { startSeconds: number; bonusSeconds: Partial<Record<ExerciseType, number>>; expiresAt: ISODateTime; }
export interface LivesOut { max: number; left: number; }
export interface ProgressOut { completed: number; total: number; }
export interface SessionOut {
  id: number; kind: SessionKind; status: SessionStatus; endReason: EndReason | null; resumed: boolean;
  node: SessionNodeRef | null; lesson: SessionLessonRef | null; rules: SessionRules; timer: TimerOut | null;
  startedAt: ISODateTime; serverNow: ISODateTime; hearts: HeartsOut; lives: LivesOut | null;
  progress: ProgressOut; mistakes: number; combo: number; bestCombo: number;
  currentItemId: number | null; blockedReason: BlockedReason | null; canComplete: boolean;
  items: SessionItemOut[];
}

export type AnswerIn =                                     // PUT /sessions/{id}/items/{itemId}/answer
  | { type: "multiple_choice"; optionId: number }
  | { type: "fill_blank"; optionId: number }
  | { type: "translate"; tileIds: number[]; text?: never }
  | { type: "translate"; text: string; tileIds?: never }
  | { type: "match_pairs"; pairs: { leftId: number; rightId: number }[]; mistakes: number }
  | { type: "type_answer"; text: string }
  | { type: "skip" }
  | { type: "cant_listen" };

export interface SessionStateOut {
  status: SessionStatus; endReason: EndReason | null; blockedReason: BlockedReason | null;
  canComplete: boolean; currentItemId: number | null; livesLeft: number | null; expiresAt: ISODateTime | null;
}
export interface AnswerResultOut {
  itemId: number; replayed: boolean; result: ItemResult; isCorrect: boolean; note: GradeNote | null;
  correctAnswer: string | null; meaning: string | null; heartLost: boolean; hearts: HeartsOut;
  progress: ProgressOut; mistakes: number; combo: number; bestCombo: number;
  appendedItem: SessionItemOut | null; session: SessionStateOut;
}

export interface XpLineOut { reason: XpReason; amount: number; }
export interface StreakDayOut { date: ISODate; state: DayState; }
export interface CompletionStats { accuracyPercent: number; durationSeconds: number; mistakes: number; bestCombo: number; perfect: boolean; itemCount: number; }
export interface CompletionStreak { before: number; after: number; extendedToday: boolean; isNewRecord: boolean; milestone: boolean; week: StreakDayOut[]; }
export interface CompletionDailyGoal { goalXp: DailyGoalXp; before: number; after: number; justMet: boolean; }
export interface CompletionNode {
  id: number; kind: NodeKind; title: string; lessonsCompleted: number; lessonCount: number;
  completedNow: boolean; legendaryNow: boolean; unlockedNodeIds: number[];
}
export interface QuestCompletedOut { code: string; title: string; rewardGems: number; }
export interface AchievementUnlockOut { code: AchievementCode; name: string; level: number; threshold: number; description: string; color: string; }
export interface CompletionLeague { joinedNow: boolean; league: LeagueBrief; weeklyXp: number; rankBefore: number | null; rankAfter: number; }
export interface TimedResultOut { correct: number; answered: number; timeUp: boolean; }
export interface CompletionOut {
  sessionId: number; kind: SessionKind; replayed: boolean;
  xp: { total: number; lines: XpLineOut[]; boostActive: boolean };
  stats: CompletionStats; streak: CompletionStreak; dailyGoal: CompletionDailyGoal;
  node: CompletionNode | null; heartsGained: number; questsCompleted: QuestCompletedOut[];
  achievementsUnlocked: AchievementUnlockOut[]; league: CompletionLeague | null; timed: TimedResultOut | null;
  recentSessionCount: number; me: MeOut;
}
export interface QuitOut { sessionId: number; status: SessionStatus; endReason: EndReason; replayed: boolean; hearts: HeartsOut; }

// ---------------- dev tools ----------------
export interface ClockOut {
  realNow: ISODateTime; offsetSeconds: number; now: ISODateTime; timezone: string;
  localNow: string;                                        // ISO with offset, e.g. "2026-10-09T17:30:00+05:30"
  localDate: ISODate; leagueWeekStart: ISODate; leagueWeekEndsAt: ISODateTime;
}
export interface ClockAdvanceIn { minutes?: number; hours?: number; days?: number; }   // total 1 min … 60 days
export interface SyncEffectsOut {
  heartsGained: number;
  streak: { before: number; after: number; freezesUsed: number; lost: boolean };
  leagueResults: LeagueResultOut[]; sessionsExpired: number;
}
export interface ClockChangeOut { clock: ClockOut; effects: SyncEffectsOut; }
export interface DevLearnerPatchIn { hearts?: number; gems?: number; }               // hearts 0..5, gems ≥ 0
export interface DevResetOut { reset: true; seededAt: ISODateTime; me: MeOut; }

// ---------------- errors (RFC 9457) ----------------
export type ErrorCode =
  | "VALIDATION_ERROR" | "INVALID_ANSWER" | "IDEMPOTENCY_KEY_REUSED" | "IDEMPOTENCY_KEY_REQUIRED"
  | "NOT_FOUND" | "METHOD_NOT_ALLOWED" | "BOT_ACCOUNT" | "DEV_TOOLS_DISABLED"
  | "NODE_LOCKED" | "NODE_NOT_PLAYABLE" | "NODE_ALREADY_COMPLETED" | "ALREADY_LEGENDARY" | "NOTHING_TO_PRACTICE"
  | "CHEST_LOCKED" | "OUT_OF_HEARTS" | "INSUFFICIENT_GEMS" | "HEARTS_ALREADY_FULL" | "MAX_FREEZES_EQUIPPED"
  | "ITEM_UNAVAILABLE" | "SESSION_NOT_ACTIVE" | "SESSION_EXPIRED" | "SESSION_INCOMPLETE"
  | "ITEM_OUT_OF_ORDER" | "ITEM_ALREADY_ANSWERED" | "LEAGUE_RESULT_NOT_READY" | "INTERNAL_ERROR";
export interface FieldError { field: string; message: string; kind: string; }
export interface ProblemDetails {
  type: string; title: string; status: number; detail: string; instance: string;
  code: ErrorCode; requestId: string; errors: FieldError[];
  // extension members (present only for the listed codes)
  nextHeartAt?: ISODateTime | null;                        // OUT_OF_HEARTS
  requiredGems?: number; balance?: number;                 // INSUFFICIENT_GEMS
  sessionStatus?: SessionStatus; endReason?: EndReason | null;   // SESSION_NOT_ACTIVE
  expiresAt?: ISODateTime;                                 // SESSION_EXPIRED
  currentItemId?: number | null;                           // ITEM_OUT_OF_ORDER
}
