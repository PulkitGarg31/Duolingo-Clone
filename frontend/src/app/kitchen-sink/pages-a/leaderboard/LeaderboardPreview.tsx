"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { LeaderboardSkeleton } from "@/features/leaderboard/LeaderboardSkeleton";
import { LeaderboardView } from "@/features/leaderboard/LeaderboardView";
import { useZoneChangeToast } from "@/features/leaderboard/useZoneChangeToast";
import { LEAGUE_STATES } from "../fixtures";
import { PreviewFrame, pickState } from "../PreviewFrame";

/** Every leaderboard state, plus a button that replays the learner climbing into the promotion zone. */
export function LeaderboardPreview({ requested }: { requested?: string }) {
  const { fixture, current } = pickState(LEAGUE_STATES, requested);
  const [climbed, setClimbed] = useState(false);
  const league = climbed ? LEAGUE_STATES.promotion : LEAGUE_STATES[fixture];
  useZoneChangeToast(league.rows);

  return (
    <PreviewFrame
      title="Leaderboard"
      states={Object.keys(LEAGUE_STATES)}
      current={current}
      skeleton={<LeaderboardSkeleton />}
      actions={
        current === "safe" && (
          <Button size="sm" variant="secondary" onClick={() => setClimbed((value) => !value)}>
            {climbed ? "Undo the lesson" : "Finish a lesson"}
          </Button>
        )
      }
    >
      <LeaderboardView league={league} />
    </PreviewFrame>
  );
}
