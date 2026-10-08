"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { PendingLeagueResultModal } from "@/features/path/LeagueResultModal";
import { useLeague } from "@/lib/queries/hooks";
import { qk } from "@/lib/queries/keys";
import { LeaderboardSkeleton } from "./LeaderboardSkeleton";
import { LeaderboardView } from "./LeaderboardView";
import { useZoneChangeToast } from "./useZoneChangeToast";

/**
 * /leaderboard. The board refreshes every minute (bots keep earning) and again when the week ends, since the
 * server finalizes the week and seats the learner in the next one; last week's result greets the learner here
 * as on the path. A failed first load goes to the route's error boundary.
 */
export function LeaderboardPage() {
  const league = useLeague();
  const queryClient = useQueryClient();
  useZoneChangeToast(league.data?.rows);

  const refreshAfterWeek = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: qk.league });
    void queryClient.invalidateQueries({ queryKey: qk.me, exact: true });
  }, [queryClient]);

  if (league.error && !league.data) throw league.error;
  return (
    <>
      {league.data ? <LeaderboardView league={league.data} onWeekEnd={refreshAfterWeek} /> : <LeaderboardSkeleton />}
      <PendingLeagueResultModal />
    </>
  );
}
