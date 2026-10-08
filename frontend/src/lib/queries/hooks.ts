import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import {
  getActivity,
  getDevClock,
  getGuidebook,
  getHealth,
  getLeague,
  getMe,
  getPath,
  getProfile,
  getPurchase,
  getQuests,
  getSession,
  getSettings,
  listCourses,
  listShopItems,
} from "@/lib/api/endpoints";
import { useServerReady } from "@/lib/api/serverStatus";
import type {
  ActivityOut,
  ClockOut,
  CoursesOut,
  GuidebookOut,
  HealthOut,
  ISODate,
  LeagueOut,
  MeOut,
  PathOut,
  ProfileOut,
  PurchaseOut,
  QuestsOut,
  SessionOut,
  SettingsOut,
  ShopOut,
} from "@/lib/api/types";
import { qk } from "./keys";

/*
 * One hook per GET endpoint. Every hook stays disabled until ServerWakeGate reports that the server answers,
 * so nothing is sent to a sleeping server and pages outside the gate never call the API. `error` is an ApiError.
 */

/** Courses and guidebooks never change while the app runs (the server caches them for 5 minutes too). */
const CONTENT_STALE_MS = 5 * 60_000;
/** Bots keep earning XP, so an open leaderboard refreshes every minute. */
const LEAGUE_REFETCH_MS = 60_000;

/** Server liveness, boot id and version. */
export function useHealth(): UseQueryResult<HealthOut> {
  const ready = useServerReady();
  return useQuery({ queryKey: qk.health, queryFn: () => getHealth(), enabled: ready });
}

/**
 * The learner's shell state: stats, hearts, streak, daily goal, league, settings. Refetched when the window
 * regains focus, so hearts regenerated and days changed while away show up on return.
 */
export function useMe(): UseQueryResult<MeOut> {
  const ready = useServerReady();
  return useQuery({ queryKey: qk.me, queryFn: getMe, enabled: ready, refetchOnWindowFocus: true });
}

/**
 * `me` as currently cached, without ever requesting it. For app-wide providers that sit outside the
 * server-ready boundary (the theme), which follow `me` once a page has loaded it.
 */
export function useCachedMe(): MeOut | undefined {
  return useQuery({ queryKey: qk.me, queryFn: getMe, enabled: false }).data;
}

export function useSettings(): UseQueryResult<SettingsOut> {
  const ready = useServerReady();
  return useQuery({ queryKey: qk.settings, queryFn: getSettings, enabled: ready });
}

/** Per-day XP, goal and streak state from `from` to `to` (learner-local dates, at most 92 days). */
export function useActivity(from: ISODate, to: ISODate): UseQueryResult<ActivityOut> {
  const ready = useServerReady();
  return useQuery({ queryKey: qk.activity(from, to), queryFn: () => getActivity({ from, to }), enabled: ready });
}

export function usePath(): UseQueryResult<PathOut> {
  const ready = useServerReady();
  return useQuery({ queryKey: qk.path, queryFn: getPath, enabled: ready });
}

export function useLeague(): UseQueryResult<LeagueOut> {
  const ready = useServerReady();
  return useQuery({ queryKey: qk.league, queryFn: getLeague, enabled: ready, refetchInterval: LEAGUE_REFETCH_MS });
}

export function useQuests(): UseQueryResult<QuestsOut> {
  const ready = useServerReady();
  return useQuery({ queryKey: qk.quests, queryFn: getQuests, enabled: ready });
}

/** A purchase receipt (the `Location` target of a purchase). */
export function usePurchaseRecord(purchaseId: number): UseQueryResult<PurchaseOut> {
  const ready = useServerReady();
  return useQuery({ queryKey: qk.purchase(purchaseId), queryFn: () => getPurchase(purchaseId), enabled: ready });
}

/** A profile with stats and achievements: the learner ("me") or anyone on the leaderboard, bots included. */
export function useProfile(userId: number | "me"): UseQueryResult<ProfileOut> {
  const ready = useServerReady();
  return useQuery({ queryKey: qk.profile(userId), queryFn: () => getProfile(userId), enabled: ready });
}

export function useCourses(): UseQueryResult<CoursesOut> {
  const ready = useServerReady();
  return useQuery({ queryKey: qk.courses, queryFn: listCourses, enabled: ready, staleTime: CONTENT_STALE_MS });
}

export function useGuidebook(unitId: number): UseQueryResult<GuidebookOut> {
  const ready = useServerReady();
  return useQuery({
    queryKey: qk.guidebook(unitId),
    queryFn: () => getGuidebook(unitId),
    enabled: ready,
    staleTime: CONTENT_STALE_MS,
  });
}

/** Shop items with their availability for the learner (hearts, freezes and gems decide it). */
export function useShop(): UseQueryResult<ShopOut> {
  const ready = useServerReady();
  return useQuery({ queryKey: qk.shop, queryFn: listShopItems, enabled: ready });
}

/**
 * A lesson session. Answers advance the session on the server without touching this cache, so a cached copy
 * can be behind: the query refetches on every mount, which makes a refresh or the browser's back and forward
 * buttons resume at the server's `currentItemId`. Seed the lesson state once the result has settled
 * (`isSuccess && !isFetching`).
 */
export function useSession(sessionId: number): UseQueryResult<SessionOut> {
  const ready = useServerReady();
  return useQuery({
    queryKey: qk.session(sessionId),
    queryFn: () => getSession(sessionId),
    enabled: ready,
    staleTime: 0,
  });
}

/** The simulated clock behind the demo tools. Only for learners whose `me.dev` is set. */
export function useDevClock(): UseQueryResult<ClockOut> {
  const ready = useServerReady();
  return useQuery({ queryKey: qk.devClock, queryFn: getDevClock, enabled: ready });
}
