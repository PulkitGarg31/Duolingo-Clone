import { useMutation, useQueryClient, type QueryClient, type UseMutationResult } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  ackLeagueResult,
  advanceDevClock,
  claimChest,
  completeSession,
  createPurchase,
  devNextDay,
  devNextWeek,
  patchDevLearner,
  quitSession,
  resetDemo,
  startSession,
  submitAnswer,
  updateSettings,
} from "@/lib/api/endpoints";
import type { ApiError } from "@/lib/api/errors";
import type {
  AnswerIn,
  AnswerResultOut,
  ChestClaimOut,
  ClockAdvanceIn,
  ClockChangeOut,
  CompletionOut,
  DevLearnerPatchIn,
  DevResetOut,
  LeagueAckOut,
  LeagueOut,
  MeOut,
  PathNodeOut,
  PathOut,
  PurchaseOut,
  QuitOut,
  SessionOut,
  SettingsOut,
  SettingsPatchIn,
  SettingsUpdateOut,
  ShopItemCode,
  StartSessionIn,
} from "@/lib/api/types";
import { qk } from "./keys";

/*
 * One hook per write. Game numbers are never guessed: caches change from the server's answer, except for a
 * few visual or preference changes applied optimistically and rolled back on error. Unreachable-server
 * failures and 500s are toasted app-wide (onUnhandledActionError); features handle domain errors through
 * `error.code`.
 */

/** Applies `change` to the cached `me`, when there is one. */
function patchMe(queryClient: QueryClient, change: (me: MeOut) => MeOut): void {
  queryClient.setQueryData<MeOut>(qk.me, (me) => (me ? change(me) : me));
}

/** Refetches `/me` alone, not every "/me/…" query below it. */
function invalidateMe(queryClient: QueryClient): Promise<void> {
  return queryClient.invalidateQueries({ queryKey: qk.me, exact: true });
}

// ------------------------------------------------------------------------------------------------ sessions

export interface StartSessionOptions {
  /** Replace the current history entry instead of adding one (starting again from inside a lesson). */
  replace?: boolean;
}

/**
 * Starts or resumes a session from a click (never on page mount) and opens the lesson player:
 * `start.mutate({ kind: "lesson", nodeId })`. Errors to handle: OUT_OF_HEARTS, NODE_LOCKED,
 * INSUFFICIENT_GEMS, NOTHING_TO_PRACTICE.
 */
export function useStartSession({ replace = false }: StartSessionOptions = {}): UseMutationResult<
  SessionOut,
  ApiError,
  StartSessionIn
> {
  const queryClient = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: startSession,
    onSuccess: (session) => {
      queryClient.setQueryData(qk.session(session.id), session);
      // `me.activeSession` changed, and a legendary start charged gems.
      void invalidateMe(queryClient);
      const href = `/lesson/${session.id}`;
      if (replace) router.replace(href);
      else router.push(href);
    },
  });
}

export interface SubmitAnswerVariables {
  sessionId: number;
  itemId: number;
  answer: AnswerIn;
}

/**
 * Grades one answer slot. Safe to repeat: the same payload replays the stored grade. The lesson reducer owns
 * the result; only the hearts in `me` are patched here.
 */
export function useSubmitAnswer(): UseMutationResult<AnswerResultOut, ApiError, SubmitAnswerVariables> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ sessionId, itemId, answer }) => submitAnswer(sessionId, itemId, answer),
    onSuccess: (result) => patchMe(queryClient, (me) => ({ ...me, hearts: result.hearts })),
  });
}

/** Completes a session (`complete.mutate(sessionId)`) and returns its receipt; a repeat returns the same one. */
export function useCompleteSession(): UseMutationResult<CompletionOut, ApiError, number> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: completeSession,
    onSuccess: (completion) => {
      queryClient.setQueryData(qk.me, completion.me);
      const stale = [
        qk.path,
        qk.league,
        qk.quests,
        qk.shop,
        ["me", "activity"],
        // The learner's own profile can be cached under "me" and under their id.
        qk.profile("me"),
        qk.profile(completion.me.user.id),
      ];
      for (const queryKey of stale) void queryClient.invalidateQueries({ queryKey });
    },
  });
}

/** Ends a session early (`quit.mutate(sessionId)`); the server decides the outcome. Safe to repeat. */
export function useQuitSession(): UseMutationResult<QuitOut, ApiError, number> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: quitSession,
    onSuccess: (quit) => {
      patchMe(queryClient, (me) => ({ ...me, hearts: quit.hearts }));
      void invalidateMe(queryClient);
      void queryClient.invalidateQueries({ queryKey: qk.path });
    },
  });
}

// ---------------------------------------------------------------------------------------------------- path

interface PathSnapshot {
  previous: PathOut | undefined;
}

/**
 * Opens a reachable chest (`claim.mutate(nodeId)`). The chest pops open at once (a visual change only, rolled
 * back on error); the gem count changes when the server confirms. Safe to repeat.
 */
export function useClaimChest(): UseMutationResult<ChestClaimOut, ApiError, number, PathSnapshot> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: claimChest,
    onMutate: async (nodeId) => {
      await queryClient.cancelQueries({ queryKey: qk.path });
      const previous = queryClient.getQueryData<PathOut>(qk.path);
      queryClient.setQueryData<PathOut>(qk.path, (path) => path && withChestOpened(path, nodeId));
      return { previous };
    },
    onError: (_error, _nodeId, snapshot) => {
      if (snapshot?.previous) queryClient.setQueryData(qk.path, snapshot.previous);
    },
    onSuccess: (claim) => {
      patchMe(queryClient, (me) => ({ ...me, gems: claim.gems }));
      void queryClient.invalidateQueries({ queryKey: qk.path });
    },
  });
}

function withChestOpened(path: PathOut, nodeId: number): PathOut {
  return {
    ...path,
    units: path.units.map((unit) => ({
      ...unit,
      nodes: unit.nodes.map((node): PathNodeOut => (node.id === nodeId ? { ...node, state: "completed" } : node)),
    })),
  };
}

// -------------------------------------------------------------------------------------------- shop, league

export interface PurchaseVariables {
  itemCode: ShopItemCode;
  /** One key per user intent: create it in the click handler with `newIdempotencyKey()`. */
  idempotencyKey: string;
}

/**
 * Buys a shop item: `purchase.mutate({ itemCode: "heart_refill", idempotencyKey: newIdempotencyKey() })`.
 * Automatic retries reuse the variables, and so the key: a retried request can never charge twice.
 * Gems are money, so nothing is optimistic. Errors to handle: INSUFFICIENT_GEMS, HEARTS_ALREADY_FULL,
 * MAX_FREEZES_EQUIPPED, ITEM_UNAVAILABLE.
 */
export function usePurchase(): UseMutationResult<PurchaseOut, ApiError, PurchaseVariables> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ itemCode, idempotencyKey }) => createPurchase({ itemCode }, idempotencyKey),
    onSuccess: ({ gems, effect }) => {
      patchMe(queryClient, (me) => ({
        ...me,
        gems,
        hearts: effect.hearts,
        streak: { ...me.streak, freezesEquipped: effect.streakFreezes },
        xpBoost: { ...me.xpBoost, active: effect.xpBoostUntil !== null, endsAt: effect.xpBoostUntil },
      }));
      void queryClient.invalidateQueries({ queryKey: qk.shop });
    },
  });
}

interface LeagueResultSnapshot {
  me: MeOut | undefined;
  league: LeagueOut | undefined;
}

/** Marks a league result as seen (`ack.mutate(membershipId)`): the modal closes at once, back on error. */
export function useAckLeagueResult(): UseMutationResult<LeagueAckOut, ApiError, number, LeagueResultSnapshot> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ackLeagueResult,
    onMutate: async (membershipId) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: qk.me, exact: true }),
        queryClient.cancelQueries({ queryKey: qk.league }),
      ]);
      const snapshot = {
        me: queryClient.getQueryData<MeOut>(qk.me),
        league: queryClient.getQueryData<LeagueOut>(qk.league),
      };
      patchMe(queryClient, (me) =>
        me.pendingLeagueResult?.membershipId === membershipId ? { ...me, pendingLeagueResult: null } : me,
      );
      queryClient.setQueryData<LeagueOut>(qk.league, (league) =>
        league?.lastWeekResult?.membershipId === membershipId
          ? { ...league, lastWeekResult: { ...league.lastWeekResult, seen: true } }
          : league,
      );
      return snapshot;
    },
    onError: (_error, _membershipId, snapshot) => {
      if (snapshot?.me) queryClient.setQueryData(qk.me, snapshot.me);
      if (snapshot?.league) queryClient.setQueryData(qk.league, snapshot.league);
    },
  });
}

// ------------------------------------------------------------------------------------------------ settings

interface SettingsSnapshot {
  settings: SettingsOut | undefined;
  me: MeOut | undefined;
}

/** The fields shown before the server confirms them. The time zone waits: the server validates it. */
function optimisticPart(patch: SettingsPatchIn): SettingsPatchIn {
  const preview = { ...patch };
  delete preview.timezone;
  return preview;
}

/**
 * Saves settings (any subset). Preferences show at once and roll back on error; a new time zone is applied
 * when the server answers, and a streak shift refreshes everything. A new daily goal refreshes the XP ring
 * (`me.dailyGoal`), the "Earn {goal} XP" quest and today's activity.
 */
export function useUpdateSettings(): UseMutationResult<SettingsUpdateOut, ApiError, SettingsPatchIn, SettingsSnapshot> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateSettings,
    onMutate: async (patch) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: qk.settings }),
        queryClient.cancelQueries({ queryKey: qk.me, exact: true }),
      ]);
      const snapshot = {
        settings: queryClient.getQueryData<SettingsOut>(qk.settings),
        me: queryClient.getQueryData<MeOut>(qk.me),
      };
      const preview = optimisticPart(patch);
      queryClient.setQueryData<SettingsOut>(qk.settings, (settings) => settings && { ...settings, ...preview });
      patchMe(queryClient, (me) => ({ ...me, settings: { ...me.settings, ...preview } }));
      return snapshot;
    },
    onError: (_error, _patch, snapshot) => {
      if (snapshot?.settings) queryClient.setQueryData(qk.settings, snapshot.settings);
      if (snapshot?.me) queryClient.setQueryData(qk.me, snapshot.me);
    },
    onSuccess: ({ timezoneEffect, ...settings }, patch) => {
      queryClient.setQueryData(qk.settings, settings);
      patchMe(queryClient, (me) => ({ ...me, settings }));
      if (timezoneEffect === "shifted") {
        // The streak moved to the new zone's calendar: every date-based number may have changed.
        void queryClient.invalidateQueries();
        return;
      }
      if (patch.dailyGoalXp !== undefined) {
        void invalidateMe(queryClient);
        void queryClient.invalidateQueries({ queryKey: qk.quests });
        void queryClient.invalidateQueries({ queryKey: ["me", "activity"] });
      }
    },
  });
}

// ------------------------------------------------------------------------------------------------ demo tools

/**
 * Demo tools change shared, non-idempotent state, so they are never retried (a retried "+5 HOURS" would jump
 * ten hours). Time travel and resets can change any number on any screen, so everything is refetched.
 */
function useDevMutation<TData, TVariables = void>(
  mutationFn: (variables: TVariables) => Promise<TData>,
): UseMutationResult<TData, ApiError, TVariables> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    retry: 0,
    onSuccess: () => void queryClient.invalidateQueries(),
  });
}

/** `advance.mutate({ hours: 5 })`: moves the server clock forward (1 minute to 60 days). */
export function useAdvanceDevClock(): UseMutationResult<ClockChangeOut, ApiError, ClockAdvanceIn> {
  return useDevMutation((delta: ClockAdvanceIn) => advanceDevClock(delta));
}

/** Jumps to the learner's next local midnight. */
export function useDevNextDay(): UseMutationResult<ClockChangeOut, ApiError, void> {
  return useDevMutation(() => devNextDay());
}

/** Jumps to next Monday 00:00 UTC, which finalizes the league week. */
export function useDevNextWeek(): UseMutationResult<ClockChangeOut, ApiError, void> {
  return useDevMutation(() => devNextWeek());
}

/** Sets hearts (0–5) or gems for a demo. */
export function usePatchDevLearner(): UseMutationResult<MeOut, ApiError, DevLearnerPatchIn> {
  return useDevMutation((patch: DevLearnerPatchIn) => patchDevLearner(patch));
}

/** Deletes all learner progress, resets the clock and re-seeds the sample learner. */
export function useResetDemo(): UseMutationResult<DevResetOut, ApiError, void> {
  return useDevMutation(() => resetDemo());
}
