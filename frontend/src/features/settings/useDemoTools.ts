"use client";

import { useIsFetching } from "@tanstack/react-query";
import { useState } from "react";
import { useToast } from "@/components/ui";
import { domainErrorMessage } from "@/features/shell/domainErrorMessage";
import { isApiError } from "@/lib/api/errors";
import type { ClockChangeOut, MeOut } from "@/lib/api/types";
import { qk } from "@/lib/queries/keys";
import {
  useAdvanceDevClock,
  useDevNextDay,
  useDevNextWeek,
  usePatchDevLearner,
  useResetDemo,
} from "@/lib/queries/mutations";
import {
  clockToast,
  isClockAction,
  learnerPatch,
  learnerToast,
  mergeEffects,
  nextDayCallsToSkipADay,
  type ClockAction,
  type DemoAction,
  type DemoTask,
} from "./demoTools";

/**
 * Runs the Demo tools buttons against `/dev/*` and reports each result in a toast. Every dev call refreshes
 * all data; the buttons wait for the learner's numbers to arrive, because SKIP A DAY and +500 GEMS are worked
 * out from them.
 */
export function useDemoTools(me: MeOut) {
  const advance = useAdvanceDevClock();
  const nextDay = useDevNextDay();
  const nextWeek = useDevNextWeek();
  const patchLearner = usePatchDevLearner();
  const resetDemo = useResetDemo();
  const { toast } = useToast();
  const [running, setRunning] = useState<DemoTask | null>(null);
  const [weekFinished, setWeekFinished] = useState(false);
  const meRefreshing = useIsFetching({ queryKey: qk.me, exact: true }) > 0;

  /** One or two jumps to the next midnight, decided by today's lesson before the first, reported as one. */
  async function skipADay(): Promise<ClockChangeOut> {
    const calls = nextDayCallsToSkipADay(me.streak.extendedToday);
    let change = await nextDay.mutateAsync();
    for (let call = 2; call <= calls; call++) {
      const next = await nextDay.mutateAsync();
      change = { clock: next.clock, effects: mergeEffects(change.effects, next.effects) };
    }
    return change;
  }

  function jump(action: ClockAction): Promise<ClockChangeOut> {
    switch (action) {
      case "hour":
        return advance.mutateAsync({ hours: 1 });
      case "fiveHours":
        return advance.mutateAsync({ hours: 5 });
      case "nextDay":
        return nextDay.mutateAsync();
      case "skipDay":
        return skipADay();
      case "nextWeek":
        return nextWeek.mutateAsync();
    }
  }

  async function perform(action: DemoAction): Promise<void> {
    if (!isClockAction(action)) {
      const after = await patchLearner.mutateAsync(learnerPatch(action, me));
      toast({ tone: "success", message: learnerToast(action, after) });
      return;
    }
    const before = { localDate: me.localDate, extendedToday: me.streak.extendedToday };
    const change = await jump(action);
    toast({ tone: "info", message: clockToast(action, change, before) });
    // A finished league week is announced by its result modal rather than a toast line.
    if (change.effects.leagueResults.length > 0) setWeekFinished(true);
  }

  async function track(task: DemoTask, work: () => Promise<void>): Promise<void> {
    setRunning(task);
    try {
      await work();
    } catch (error) {
      reportFailure(error);
    } finally {
      setRunning(null);
    }
  }

  /** An unreachable server or a server bug is toasted app-wide; the answers that explain themselves are ours. */
  function reportFailure(error: unknown): void {
    if (!isApiError(error)) throw error;
    const message = domainErrorMessage(error, { DEV_TOOLS_DISABLED: "Demo tools are turned off on this server." });
    if (message) toast({ tone: "error", message, requestId: error.requestId });
  }

  return {
    running,
    busy: running !== null || meRefreshing,
    /** A jump finalized a league week, and the refreshed `me` holds its result in `pendingLeagueResult`. */
    weekFinished: weekFinished && !meRefreshing,
    run: (action: DemoAction) => track(action, () => perform(action)),
    reset: () =>
      track("reset", async () => {
        await resetDemo.mutateAsync();
        toast({ tone: "success", message: "Demo data reset to the sample learner." });
      }),
  };
}
