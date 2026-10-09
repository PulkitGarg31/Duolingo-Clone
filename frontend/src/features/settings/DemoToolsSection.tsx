"use client";

import { useState } from "react";
import { LeagueResultModal } from "@/features/path/LeagueResultModal";
import type { LeagueResultOut, MeOut } from "@/lib/api/types";
import { useDevClock } from "@/lib/queries/hooks";
import { useAckLeagueResult } from "@/lib/queries/mutations";
import { weekResultToShow } from "./demoTools";
import { TimeTravelPanel } from "./TimeTravelPanel";
import { useDemoTools } from "./useDemoTools";

/**
 * The Demo tools card wired to the server. Settings renders it only when the server has dev tools on. When a
 * jump ends a league week, that week's result modal opens here, as it would on the path.
 */
export function DemoToolsSection({ me }: { me: MeOut }) {
  const clock = useDevClock();
  const tools = useDemoTools(me);
  return (
    <>
      <TimeTravelPanel clock={clock.data} running={tools.running} busy={tools.busy} onRun={tools.run} onReset={tools.reset} />
      <WeekResultModal result={weekResultToShow(me.pendingLeagueResult, tools.finishedWeeks)} />
    </>
  );
}

/** The result of a week a jump just finished; CONTINUE acknowledges it, as on the path. */
function WeekResultModal({ result }: { result: LeagueResultOut | null }) {
  const ack = useAckLeagueResult();
  // The acknowledged result leaves `me` at once; keep showing it while the modal fades out.
  const [shown, setShown] = useState(result);
  if (result !== null && result.membershipId !== shown?.membershipId) setShown(result);
  return (
    <LeagueResultModal
      result={shown}
      open={result !== null}
      onContinue={() => {
        if (result) ack.mutate(result.membershipId);
      }}
    />
  );
}
