import { apiFetch } from "./client";
import type {
  ActivityOut,
  AnswerIn,
  AnswerResultOut,
  ChestClaimOut,
  ClockAdvanceIn,
  ClockChangeOut,
  ClockOut,
  CompletionOut,
  CoursesOut,
  DevLearnerPatchIn,
  DevResetOut,
  GuidebookOut,
  HealthOut,
  ISODate,
  LeagueAckOut,
  LeagueOut,
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
