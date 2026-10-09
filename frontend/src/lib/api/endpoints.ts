import { apiFetch } from "./client";
import type {
  ActivityOut,
  AnswerIn,
  AnswerResultOut,
  AuthOut,
  ChestClaimOut,
  ClockAdvanceIn,
  ClockChangeOut,
  ClockOut,
  CompletionOut,
  CoursesOut,
  DemoIn,
  DevLearnerPatchIn,
  DevResetOut,
  GuidebookOut,
  HealthOut,
  ISODate,
  LeagueAckOut,
  LeagueOut,
  LoginIn,
  LogoutOut,
  MeOut,
  PathOut,
  ProfileOut,
  PurchaseIn,
  PurchaseOut,
  QuestsOut,
  QuitOut,
  SessionOut,
  SettingsOut,
  SettingsPatchIn,
  SettingsUpdateOut,
  ShopOut,
  SignupIn,
  StartSessionIn,
} from "./types";

/*
 * One typed function per API operation, named after its operation id. This is the only file that knows URLs;
 * features reach it through the hooks in lib/queries.
 */

/** "?from=2026-10-01" from the defined values only. */
function queryString(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) search.set(key, value);
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}

// ---------------- system

export function getHealth(options: { timeoutMs?: number } = {}): Promise<HealthOut> {
  return apiFetch<HealthOut>("/health", options);
}

// ---------------- auth

/** Creates an account and signs it in. Errors: EMAIL_TAKEN, VALIDATION_ERROR (field errors in `errors`). */
export function signup(body: SignupIn): Promise<AuthOut> {
  return apiFetch<AuthOut>("/auth/signup", { json: body, token: null });
}

/** Errors: INVALID_CREDENTIALS (unknown email and wrong password alike), VALIDATION_ERROR. */
export function login(body: LoginIn): Promise<AuthOut> {
  return apiFetch<AuthOut>("/auth/login", { json: body, token: null });
}

const LOGOUT_TIMEOUT_MS = 5_000;

/** Revokes `token` on the server. Always answers 200, even for a token the server no longer knows. */
export function logout(token: string): Promise<LogoutOut> {
  return apiFetch<LogoutOut>("/auth/logout", { method: "POST", token, timeoutMs: LOGOUT_TIMEOUT_MS });
}

/**
 * Creates a guest, the visitor's private copy of the demo (the sample learner's history), and signs it in.
 * `timezone` is the device's IANA zone; without one the guest's days follow the server's seed zone until the
 * app adopts the device's. Errors: VALIDATION_ERROR (a zone the server does not know).
 */
export function startDemo(timezone: string | null): Promise<AuthOut> {
  const body: DemoIn = timezone ? { timezone } : {};
  return apiFetch<AuthOut>("/auth/demo", { json: body, token: null });
}

// ---------------- /me

export function getMe(): Promise<MeOut> {
  return apiFetch<MeOut>("/me");
}

export function getSettings(): Promise<SettingsOut> {
  return apiFetch<SettingsOut>("/me/settings");
}

export function updateSettings(patch: SettingsPatchIn): Promise<SettingsUpdateOut> {
  return apiFetch<SettingsUpdateOut>("/me/settings", { method: "PATCH", json: patch });
}

/** Per-day activity from `from` to `to` (learner-local dates). The server defaults to the last 35 days. */
export function getActivity(range: { from?: ISODate; to?: ISODate } = {}): Promise<ActivityOut> {
  return apiFetch<ActivityOut>(`/me/activity${queryString(range)}`);
}

// ---------------- path and content

export function getPath(): Promise<PathOut> {
  return apiFetch<PathOut>("/me/path");
}

export function claimChest(nodeId: number): Promise<ChestClaimOut> {
  return apiFetch<ChestClaimOut>(`/me/chests/${nodeId}/claim`, { method: "POST" });
}

export function listCourses(): Promise<CoursesOut> {
  return apiFetch<CoursesOut>("/courses");
}

export function getGuidebook(unitId: number): Promise<GuidebookOut> {
  return apiFetch<GuidebookOut>(`/units/${unitId}/guidebook`);
}

// ---------------- league and quests

export function getLeague(): Promise<LeagueOut> {
  return apiFetch<LeagueOut>("/me/league");
}

export function ackLeagueResult(membershipId: number): Promise<LeagueAckOut> {
  return apiFetch<LeagueAckOut>(`/me/league/results/${membershipId}/ack`, { method: "POST" });
}

export function getQuests(): Promise<QuestsOut> {
  return apiFetch<QuestsOut>("/me/quests");
}

// ---------------- shop and purchases

export function listShopItems(): Promise<ShopOut> {
  return apiFetch<ShopOut>("/shop/items");
}

/** `idempotencyKey` belongs to one user intent: retries of the same click must reuse it. */
export function createPurchase(body: PurchaseIn, idempotencyKey: string): Promise<PurchaseOut> {
  return apiFetch<PurchaseOut>("/me/purchases", { json: body, idempotencyKey });
}

export function getPurchase(purchaseId: number): Promise<PurchaseOut> {
  return apiFetch<PurchaseOut>(`/me/purchases/${purchaseId}`);
}

// ---------------- profiles

export function getProfile(userId: number | "me"): Promise<ProfileOut> {
  return apiFetch<ProfileOut>(`/users/${userId}/profile`);
}

// ---------------- sessions

export function startSession(body: StartSessionIn): Promise<SessionOut> {
  return apiFetch<SessionOut>("/sessions", { json: body });
}

export function getSession(sessionId: number): Promise<SessionOut> {
  return apiFetch<SessionOut>(`/sessions/${sessionId}`);
}

export function submitAnswer(sessionId: number, itemId: number, answer: AnswerIn): Promise<AnswerResultOut> {
  return apiFetch<AnswerResultOut>(`/sessions/${sessionId}/items/${itemId}/answer`, { method: "PUT", json: answer });
}

export function completeSession(sessionId: number): Promise<CompletionOut> {
  return apiFetch<CompletionOut>(`/sessions/${sessionId}/complete`, { method: "POST" });
}

export function quitSession(sessionId: number): Promise<QuitOut> {
  return apiFetch<QuitOut>(`/sessions/${sessionId}/quit`, { method: "POST" });
}

// ---------------- demo tools

export function getDevClock(): Promise<ClockOut> {
  return apiFetch<ClockOut>("/dev/clock");
}

export function advanceDevClock(delta: ClockAdvanceIn): Promise<ClockChangeOut> {
  return apiFetch<ClockChangeOut>("/dev/clock/advance", { json: delta });
}

export function devNextDay(): Promise<ClockChangeOut> {
  return apiFetch<ClockChangeOut>("/dev/clock/next-day", { method: "POST" });
}

export function devNextWeek(): Promise<ClockChangeOut> {
  return apiFetch<ClockChangeOut>("/dev/clock/next-week", { method: "POST" });
}

export function patchDevLearner(patch: DevLearnerPatchIn): Promise<MeOut> {
  return apiFetch<MeOut>("/dev/learner", { method: "PATCH", json: patch });
}

export function resetDemo(): Promise<DevResetOut> {
  return apiFetch<DevResetOut>("/dev/reset", { method: "POST" });
}
