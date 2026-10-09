import type { QueryClient, QueryKey, UseMutationOptions } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { API_BASE_URL } from "@/lib/api/client";
import { devNextDay } from "@/lib/api/endpoints";
import type { ApiError } from "@/lib/api/errors";
import type {
  AnswerResultOut,
  ChestClaimOut,
  CompletionOut,
  HeartsOut,
  LeagueOut,
  LeagueResultOut,
  MeOut,
  PathOut,
  PurchaseOut,
  QuitOut,
  SessionOut,
  SettingsOut,
  SettingsUpdateOut,
} from "@/lib/api/types";
import { qk } from "./keys";
import {
  ackLeagueResultMutation,
  claimChestMutation,
  completeSessionMutation,
  devMutation,
  purchaseMutation,
  quitSessionMutation,
  startSessionMutation,
  submitAnswerMutation,
  updateSettingsMutation,
} from "./mutations";
import { createQueryClient } from "./queryClient";

// ------------------------------------------------------------------------------------------------ fixtures

const hearts: HeartsOut = {
  current: 4,
  max: 5,
  nextHeartAt: "2026-10-08T16:00:00Z",
  fullAt: "2026-10-08T16:00:00Z",
  regenIntervalSeconds: 18000,
  refillPriceGems: 350,
};

const settings: SettingsOut = {
  dailyGoalXp: 20,
  theme: "system",
  soundEffects: true,
  animations: true,
  motivationalMessages: true,
  listeningExercises: true,
  timezone: "Asia/Kolkata",
};

const pendingResult: LeagueResultOut = {
  membershipId: 31,
  weekStart: "2026-09-28",
  league: { tier: 1, name: "Bronze", color: "#D4A880" },
  finalRank: 6,
  finalXp: 112,
  outcome: "promoted",
  newLeague: { tier: 2, name: "Silver", color: "#C9D6E2" },
  seen: false,
};

const me: MeOut = {
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
  localDate: "2026-10-08",
  xp: { total: 373, today: 0, thisWeek: 42 },
  gems: 820,
  hearts,
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
  pendingLeagueResult: pendingResult,
  settings,
  dev: { enabled: true, clockOffsetSeconds: 0 },
};

const noActions = {
  canStart: false,
  startXp: null,
  canPractice: false,
  practiceXp: 5,
  canLegendary: false,
  legendaryXp: 40,
  legendaryPriceGems: 100,
};

const path: PathOut = {
  course: me.course,
  currentNodeId: 6,
  units: [
    {
      id: 2,
      number: 2,
      section: 1,
      title: "Order food and drinks",
      description: "Order at a café",
      color: "purple",
      state: "in_progress",
      hasGuidebook: true,
      nodes: [
        {
          id: 6,
          position: 2,
          kind: "skill",
          title: "Drinks",
          state: "active",
          crownLevel: 0,
          lessonsCompleted: 1,
          lessonCount: 3,
          nextLessonNumber: 2,
          chestGems: null,
          actions: { ...noActions, canStart: true, startXp: 10 },
        },
        {
          id: 7,
          position: 3,
          kind: "chest",
          title: "Treasure chest",
          state: "available",
          crownLevel: 0,
          lessonsCompleted: 0,
          lessonCount: 0,
          nextLessonNumber: null,
          chestGems: 20,
          actions: noActions,
        },
      ],
    },
  ],
};

const league: LeagueOut = {
  unlocked: true,
  lessonsToUnlock: 0,
  joined: true,
  league: { tier: 2, name: "Silver", color: "#C9D6E2" },
  tiers: [],
  weekStart: "2026-10-05",
  weekEndsAt: "2026-10-12T00:00:00Z",
  serverNow: "2026-10-08T12:00:00Z",
  promoteCount: 15,
  demoteCount: 7,
  cohortSize: 30,
  rows: [],
  lastWeekResult: pendingResult,
};

const session: SessionOut = {
  id: 14,
  kind: "lesson",
  status: "active",
  endReason: null,
  resumed: false,
  node: { id: 6, kind: "skill", title: "Drinks", unitId: 2, unitNumber: 2, unitColor: "purple" },
  lesson: { id: 17, number: 2, count: 3 },
  rules: { heartsEnabled: true, retryPolicy: "always", hintsEnabled: true, maxMistakes: null },
  timer: null,
  startedAt: "2026-10-08T12:00:00Z",
  serverNow: "2026-10-08T12:00:00Z",
  hearts,
  lives: null,
  progress: { completed: 0, total: 8 },
  mistakes: 0,
  combo: 0,
  bestCombo: 0,
  currentItemId: 103,
  blockedReason: null,
  canComplete: false,
  items: [],
};

const ACTIVITY_KEY = qk.activity("2026-10-02", "2026-10-08");

// ------------------------------------------------------------------------------------------------ harness

interface Request {
  route: string;
  headers: Record<string, string>;
  body: unknown;
}

type Handler = () => Response | Promise<Response>;

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

function problem(status: number, code: string): Response {
  const body = { type: "/problems/x", title: code, status, detail: code, instance: "/", code, requestId: "r1", errors: [] };
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/problem+json" } });
}

function gatewayPage(status: number): Response {
  return new Response("<html>waking up</html>", { status, headers: { "Content-Type": "text/html" } });
}

/** Stubs fetch with one queue of answers per "METHOD /path" and records every request. */
function serve(routes: Record<string, Handler[]>): Request[] {
  const requests: Request[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      const route = `${init.method} ${url.slice(API_BASE_URL.length)}`;
      requests.push({
        route,
        headers: init.headers as Record<string, string>,
        body: typeof init.body === "string" ? JSON.parse(init.body) : undefined,
      });
      const next = routes[route]?.shift();
      return next ? next() : problem(404, "NOT_FOUND");
    }),
  );
  return requests;
}

/** A response the test releases by hand, to look at the cache while the request is in flight. */
function deferred() {
  let release!: (response: Response) => void;
  let markSent!: () => void;
  const sent = new Promise<void>((resolve) => (markSent = resolve));
  const response = new Promise<Response>((resolve) => (release = resolve));
  const handler: Handler = () => {
    markSent();
    return response;
  };
  return { handler, sent, release };
}

function run<TData, TVariables, TSnapshot>(
  client: QueryClient,
  options: UseMutationOptions<TData, ApiError, TVariables, TSnapshot>,
  variables: TVariables,
): Promise<TData> {
  return client.getMutationCache().build(client, options).execute(variables);
}

/** A client whose cache holds the learner's screens, as after browsing the app. */
function seededClient(): QueryClient {
  const client = createQueryClient();
  client.setQueryData(qk.me, me);
  client.setQueryData(qk.settings, settings);
  client.setQueryData(qk.path, path);
  client.setQueryData(qk.league, league);
  client.setQueryData(qk.quests, { placeholder: "quests" });
  client.setQueryData(qk.shop, { placeholder: "shop" });
  client.setQueryData(ACTIVITY_KEY, { placeholder: "activity" });
  client.setQueryData(qk.profile("me"), { placeholder: "profile" });
  client.setQueryData(qk.profile(1), { placeholder: "profile" });
  client.setQueryData(qk.devClock, { placeholder: "clock" });
  return client;
}

function invalidated(client: QueryClient, queryKey: QueryKey): boolean {
  return client.getQueryState(queryKey)?.isInvalidated ?? false;
}

function cachedMe(client: QueryClient): MeOut {
  const cached = client.getQueryData<MeOut>(qk.me);
  if (!cached) throw new Error("me is not cached");
  return cached;
}

function chestState(client: QueryClient): string | undefined {
  return client
    .getQueryData<PathOut>(qk.path)
    ?.units.flatMap((unit) => unit.nodes)
    .find((node) => node.id === 7)?.state;
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

// ----------------------------------------------------------------------------------------------- the table

describe("query keys", () => {
  it("follow the documented shapes, with user-scoped data under 'me'", () => {
    expect(qk.health).toEqual(["health"]);
    expect(qk.me).toEqual(["me"]);
    expect(qk.settings).toEqual(["me", "settings"]);
    expect(qk.activity("2026-10-02", "2026-10-08")).toEqual(["me", "activity", "2026-10-02", "2026-10-08"]);
    expect(qk.path).toEqual(["me", "path"]);
    expect(qk.league).toEqual(["me", "league"]);
    expect(qk.quests).toEqual(["me", "quests"]);
    expect(qk.purchase(7)).toEqual(["me", "purchases", 7]);
    expect(qk.profile("me")).toEqual(["profile", "me"]);
    expect(qk.courses).toEqual(["courses"]);
    expect(qk.guidebook(2)).toEqual(["guidebook", 2]);
    expect(qk.shop).toEqual(["shop"]);
    expect(qk.session(14)).toEqual(["session", 14]);
    expect(qk.devClock).toEqual(["dev", "clock"]);
  });
});

describe("starting a session", () => {
  it("caches the session, refreshes /me alone and opens the player", async () => {
    const client = seededClient();
    const requests = serve({ "POST /sessions": [() => json(session, 201)] });
    const openLesson = vi.fn();

    await run(client, startSessionMutation(client, openLesson), { kind: "lesson", nodeId: 6 });

    expect(requests[0].body).toEqual({ kind: "lesson", nodeId: 6 });
    expect(client.getQueryData(qk.session(14))).toEqual(session);
    expect(invalidated(client, qk.me)).toBe(true);
    expect(invalidated(client, qk.path)).toBe(false);
    expect(openLesson).toHaveBeenCalledWith("/lesson/14");
  });
});

describe("submitting an answer", () => {
  it("patches the hearts in me and touches nothing else", async () => {
    const client = seededClient();
    const result: AnswerResultOut = {
      itemId: 103,
      replayed: false,
      result: "skipped",
      isCorrect: false,
      note: null,
      correctAnswer: "Quiero agua",
      meaning: null,
      heartLost: true,
      hearts: { ...hearts, current: 3 },
      progress: { completed: 1, total: 8 },
      mistakes: 1,
      combo: 0,
      bestCombo: 0,
      appendedItem: null,
      session: {
        status: "active",
        endReason: null,
        blockedReason: null,
        canComplete: false,
        currentItemId: 104,
        livesLeft: null,
        expiresAt: null,
      },
    };
    const requests = serve({ "PUT /sessions/14/items/103/answer": [() => json(result)] });

    await run(client, submitAnswerMutation(client), { sessionId: 14, itemId: 103, answer: { type: "skip" } });

    expect(requests[0].body).toEqual({ type: "skip" });
    expect(cachedMe(client).hearts.current).toBe(3);
    expect(cachedMe(client).gems).toBe(820);
    expect(invalidated(client, qk.me)).toBe(false);
  });
});

describe("completing a session", () => {
  it("stores the receipt's me and refreshes every screen the lesson changed", async () => {
    const client = seededClient();
    const meAfter: MeOut = { ...me, gems: 830, xp: { ...me.xp, total: 383, today: 10 } };
    const completion: CompletionOut = {
      sessionId: 14,
      kind: "lesson",
      replayed: false,
      xp: { total: 10, lines: [{ reason: "lesson", amount: 10 }], boostActive: false },
      stats: { accuracyPercent: 100, durationSeconds: 95, mistakes: 0, bestCombo: 8, perfect: true, itemCount: 8 },
      streak: { before: 13, after: 14, extendedToday: true, isNewRecord: true, milestone: true, week: [] },
      dailyGoal: { goalXp: 20, before: 0, after: 10, justMet: false },
      node: null,
      heartsGained: 0,
      questsCompleted: [],
      achievementsUnlocked: [],
      league: null,
      timed: null,
      recentSessionCount: 1,
      me: meAfter,
    };
    serve({ "POST /sessions/14/complete": [() => json(completion)] });

    await run(client, completeSessionMutation(client), 14);

    expect(client.getQueryData(qk.me)).toEqual(meAfter);
    expect(invalidated(client, qk.me)).toBe(false);
    for (const key of [qk.path, qk.league, qk.quests, qk.shop, ACTIVITY_KEY, qk.profile("me"), qk.profile(1)]) {
      expect(invalidated(client, key), JSON.stringify(key)).toBe(true);
    }
    expect(invalidated(client, qk.settings)).toBe(false);
  });
});

describe("quitting a session", () => {
  it("patches the hearts, then refreshes me and the path", async () => {
    const client = seededClient();
    const quit: QuitOut = { sessionId: 14, status: "abandoned", endReason: "quit", replayed: false, hearts: { ...hearts, current: 2 } };
    serve({ "POST /sessions/14/quit": [() => json(quit)] });

    await run(client, quitSessionMutation(client), 14);

    expect(cachedMe(client).hearts.current).toBe(2);
    expect(invalidated(client, qk.me)).toBe(true);
    expect(invalidated(client, qk.path)).toBe(true);
    expect(invalidated(client, qk.league)).toBe(false);
  });
});

describe("claiming a chest", () => {
  it("opens the chest at once, and changes the gems only when the server confirms", async () => {
    const client = seededClient();
    const server = deferred();
    serve({ "POST /me/chests/7/claim": [server.handler] });

    const claim = run(client, claimChestMutation(client), 7);
    await server.sent;
    expect(chestState(client)).toBe("completed");
    expect(cachedMe(client).gems).toBe(820);

    const answer: ChestClaimOut = { nodeId: 7, gemsAwarded: 20, gems: 840, replayed: false };
    server.release(json(answer));
    await claim;

    expect(cachedMe(client).gems).toBe(840);
    expect(invalidated(client, qk.path)).toBe(true);
  });

  it("closes the chest again when the claim fails", async () => {
    const client = seededClient();
    serve({ "POST /me/chests/7/claim": [() => problem(409, "CHEST_LOCKED")] });

    await expect(run(client, claimChestMutation(client), 7)).rejects.toMatchObject({ code: "CHEST_LOCKED" });

    expect(chestState(client)).toBe("available");
    expect(cachedMe(client).gems).toBe(820);
  });
});

describe("purchases", () => {
  const refill: PurchaseOut = {
    id: 7,
    itemCode: "heart_refill",
    priceGems: 350,
    purchasedAt: "2026-10-08T12:05:00Z",
    replayed: false,
    gems: 470,
    effect: { hearts: { ...hearts, current: 5, nextHeartAt: null, fullAt: null }, streakFreezes: 2, xpBoostUntil: null },
  };
  const KEY = "8f2d7c1e-0000-4000-8000-000000000001";

  it("changes nothing until the receipt arrives, then patches gems, hearts, freezes and boost", async () => {
    const client = seededClient();
    const server = deferred();
    const requests = serve({ "POST /me/purchases": [server.handler] });

    const purchase = run(client, purchaseMutation(client), { itemCode: "heart_refill", idempotencyKey: KEY });
    await server.sent;
    expect(cachedMe(client)).toEqual(me);

    server.release(json(refill, 201));
    await purchase;

    expect(requests[0].body).toEqual({ itemCode: "heart_refill" });
    expect(requests[0].headers["Idempotency-Key"]).toBe(KEY);
    const after = cachedMe(client);
    expect(after.gems).toBe(470);
    expect(after.hearts).toEqual(refill.effect.hearts);
    expect(after.streak.freezesEquipped).toBe(2);
    expect(after.xpBoost).toEqual({ active: false, endsAt: null, multiplier: 2 });
    expect(invalidated(client, qk.shop)).toBe(true);
    expect(invalidated(client, qk.me)).toBe(false);
  });

  it("marks a boost active only while its end is still ahead", async () => {
    const client = seededClient();
    const endsAt = new Date(Date.now() + 15 * 60_000).toISOString();
    const expired = new Date(Date.now() - 60_000).toISOString();
    serve({
      "POST /me/purchases": [
        () => json({ ...refill, itemCode: "xp_boost_15", effect: { ...refill.effect, xpBoostUntil: endsAt } }, 201),
        () => json({ ...refill, effect: { ...refill.effect, xpBoostUntil: expired } }, 201),
      ],
    });

    await run(client, purchaseMutation(client), { itemCode: "xp_boost_15", idempotencyKey: KEY });
    expect(cachedMe(client).xpBoost).toEqual({ active: true, endsAt, multiplier: 2 });

    await run(client, purchaseMutation(client), { itemCode: "heart_refill", idempotencyKey: "another-intent" });
    expect(cachedMe(client).xpBoost).toEqual({ active: false, endsAt: null, multiplier: 2 });
  });

  it("retries a server that is waking up with the same idempotency key", async () => {
    vi.useFakeTimers();
    const client = seededClient();
    const requests = serve({ "POST /me/purchases": [() => gatewayPage(503), () => json(refill, 201)] });

    const purchase = run(client, purchaseMutation(client), { itemCode: "heart_refill", idempotencyKey: KEY });
    await vi.advanceTimersByTimeAsync(1_000);
    await purchase;

    expect(requests.map((request) => request.headers["Idempotency-Key"])).toEqual([KEY, KEY]);
    expect(cachedMe(client).gems).toBe(470);
  });

  it("never retries a refusal, and leaves the balance alone", async () => {
    const client = seededClient();
    const requests = serve({ "POST /me/purchases": [() => problem(409, "INSUFFICIENT_GEMS")] });

    await expect(
      run(client, purchaseMutation(client), { itemCode: "heart_refill", idempotencyKey: KEY }),
    ).rejects.toMatchObject({ code: "INSUFFICIENT_GEMS" });

    expect(requests).toHaveLength(1);
    expect(cachedMe(client).gems).toBe(820);
  });
});

describe("league results", () => {
  it("hides the result modal at once and marks last week's result seen", async () => {
    const client = seededClient();
    const server = deferred();
    serve({ "POST /me/league/results/31/ack": [server.handler] });

    const ack = run(client, ackLeagueResultMutation(client), 31);
    await server.sent;
    expect(cachedMe(client).pendingLeagueResult).toBeNull();
    expect(client.getQueryData<LeagueOut>(qk.league)?.lastWeekResult?.seen).toBe(true);

    server.release(json({ membershipId: 31, seenAt: "2026-10-08T12:00:03Z" }));
    await ack;
    expect(cachedMe(client).pendingLeagueResult).toBeNull();
  });

  it("brings the result back when the acknowledgement fails", async () => {
    const client = seededClient();
    serve({ "POST /me/league/results/31/ack": [() => problem(409, "LEAGUE_RESULT_NOT_READY")] });

    await expect(run(client, ackLeagueResultMutation(client), 31)).rejects.toMatchObject({
      code: "LEAGUE_RESULT_NOT_READY",
    });

    expect(cachedMe(client).pendingLeagueResult).toEqual(pendingResult);
    expect(client.getQueryData<LeagueOut>(qk.league)?.lastWeekResult?.seen).toBe(false);
  });

  it("reloads me and the league after a failed acknowledgement, in case the result changed", async () => {
    const client = seededClient();
    serve({ "POST /me/league/results/31/ack": [() => problem(404, "NOT_FOUND")] });

    await expect(run(client, ackLeagueResultMutation(client), 31)).rejects.toMatchObject({ code: "NOT_FOUND" });

    expect(client.getQueryState(qk.me)?.isInvalidated).toBe(true);
    expect(client.getQueryState(qk.league)?.isInvalidated).toBe(true);
  });
});

describe("settings", () => {
  function saved(patch: Partial<SettingsUpdateOut>): SettingsUpdateOut {
    return { ...settings, timezoneEffect: "none", ...patch };
  }

  it("shows preferences at once but waits for the server to apply a time zone", async () => {
    const client = seededClient();
    const server = deferred();
    serve({ "PATCH /me/settings": [server.handler] });

    const save = run(client, updateSettingsMutation(client), { theme: "dark", timezone: "America/New_York" });
    await server.sent;
    expect(client.getQueryData<SettingsOut>(qk.settings)).toMatchObject({ theme: "dark", timezone: "Asia/Kolkata" });
    expect(cachedMe(client).settings).toMatchObject({ theme: "dark", timezone: "Asia/Kolkata" });

    server.release(json(saved({ theme: "dark", timezone: "America/New_York" })));
    await save;

    const expected = { ...settings, theme: "dark", timezone: "America/New_York" };
    expect(client.getQueryData(qk.settings)).toEqual(expected);
    expect(cachedMe(client).settings).toEqual(expected);
    expect(invalidated(client, qk.me)).toBe(false);
    expect(invalidated(client, qk.path)).toBe(false);
  });

  it("rolls the preview back when saving fails", async () => {
    const client = seededClient();
    serve({ "PATCH /me/settings": [() => problem(422, "VALIDATION_ERROR")] });

    await expect(run(client, updateSettingsMutation(client), { soundEffects: false })).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });

    expect(client.getQueryData(qk.settings)).toEqual(settings);
    expect(cachedMe(client).settings).toEqual(settings);
  });

  it("refreshes the XP ring, the goal quest and the activity after a new daily goal", async () => {
    const client = seededClient();
    serve({ "PATCH /me/settings": [() => json(saved({ dailyGoalXp: 30 }))] });

    await run(client, updateSettingsMutation(client), { dailyGoalXp: 30 });

    expect(invalidated(client, qk.me)).toBe(true);
    expect(invalidated(client, qk.quests)).toBe(true);
    expect(invalidated(client, ACTIVITY_KEY)).toBe(true);
    expect(invalidated(client, qk.path)).toBe(false);
  });

  // "shifted": the streak moved to the new zone's calendar; "reseeded": the untouched sample history was rebuilt in
  // the new zone, with new rows and ids (the pending league result's among them).
  it.each(["shifted", "reseeded"] as const)("refreshes everything when a time zone change reports %s", async (timezoneEffect) => {
    const client = seededClient();
    serve({ "PATCH /me/settings": [() => json(saved({ timezone: "America/New_York", timezoneEffect }))] });

    await run(client, updateSettingsMutation(client), { timezone: "America/New_York" });

    for (const key of [qk.me, qk.path, qk.league, qk.quests, qk.shop, ACTIVITY_KEY, qk.devClock]) {
      expect(invalidated(client, key), JSON.stringify(key)).toBe(true);
    }
  });
});

describe("demo tools", () => {
  it("refresh every query after a change", async () => {
    const client = seededClient();
    serve({ "POST /dev/clock/next-day": [() => json({ placeholder: "clock change" })] });

    await run(client, devMutation(client, devNextDay), undefined);

    for (const key of [qk.me, qk.path, qk.league, qk.shop, qk.devClock]) {
      expect(invalidated(client, key), JSON.stringify(key)).toBe(true);
    }
  });

  it("are never retried, because time travel is not idempotent", async () => {
    vi.useFakeTimers();
    const client = seededClient();
    const requests = serve({ "POST /dev/clock/next-day": [() => gatewayPage(503), () => json({})] });

    const outcome = run(client, devMutation(client, devNextDay), undefined).catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(10_000);

    expect(await outcome).toMatchObject({ status: 503 });
    expect(requests).toHaveLength(1);
  });
});
