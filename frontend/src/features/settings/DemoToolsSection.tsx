"use client";

import { PendingLeagueResultModal } from "@/features/path/LeagueResultModal";
import type { MeOut } from "@/lib/api/types";
import { useDevClock } from "@/lib/queries/hooks";
import { TimeTravelPanel } from "./TimeTravelPanel";
import { useDemoTools } from "./useDemoTools";

/**
 * The Demo tools card wired to the server. Settings renders it only when the server has dev tools on. When a
 * jump ends a league week, the result modal opens here, as it would on the path.
 */
export function DemoToolsSection({ me }: { me: MeOut }) {
  const clock = useDevClock();
  const tools = useDemoTools(me);
  return (
    <>
      <TimeTravelPanel clock={clock.data} running={tools.running} busy={tools.busy} onRun={tools.run} onReset={tools.reset} />
      {tools.weekFinished && <PendingLeagueResultModal />}
    </>
  );
}
