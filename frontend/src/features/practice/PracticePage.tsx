"use client";

import { useState } from "react";
import { useToast } from "@/components/ui";
import { LegendaryIntroModal } from "@/features/path/LegendaryIntroModal";
import type { PathNodeOut, StartSessionIn } from "@/lib/api/types";
import { useMe, usePath } from "@/lib/queries/hooks";
import { useStartSession } from "@/lib/queries/mutations";
import { PracticeHub } from "./PracticeHub";
import { startErrorMessage } from "./practiceOptions";
import { PracticeSkeleton } from "./PracticeSkeleton";
import { TimedIntro } from "./TimedIntro";

/** The skill picked for Legendary stays set while its intro closes, so the modal's text holds as it fades. */
interface LegendaryChoice {
  node: PathNodeOut | null;
  open: boolean;
}

const NO_CHOICE: LegendaryChoice = { node: null, open: false };

/**
 * /practice. Sessions start only from a click: "Practice to earn hearts" straight away, Timed practice and
 * Legendary from their intros. A started session opens the lesson player; a refused one explains itself in a
 * toast. A failed first load goes to the route's error boundary.
 */
export function PracticePage() {
  const me = useMe();
  const path = usePath();
  const start = useStartSession();
  const { toast } = useToast();
  const [timedOpen, setTimedOpen] = useState(false);
  const [legendary, setLegendary] = useState<LegendaryChoice>(NO_CHOICE);
  const starting = start.isPending ? start.variables.kind : null;

  function begin(body: StartSessionIn) {
    if (start.isPending) return;
    start.mutate(body, {
      onError: (error) => {
        setTimedOpen(false);
        setLegendary((choice) => ({ ...choice, open: false }));
        const message = startErrorMessage(error);
        if (message) toast({ tone: "warning", message });
      },
    });
  }

  if (me.data && path.data) {
    const { node } = legendary;
    return (
      <>
        <PracticeHub
          me={me.data}
          path={path.data}
          practiceStarting={starting === "practice"}
          onEarnHearts={() => begin({ kind: "practice" })}
          onTimed={() => setTimedOpen(true)}
          onLegendary={(picked) => setLegendary({ node: picked, open: true })}
        />
        <TimedIntro
          open={timedOpen}
          starting={starting === "timed"}
          onStart={() => begin({ kind: "timed" })}
          onClose={() => setTimedOpen(false)}
        />
        <LegendaryIntroModal
          open={legendary.open}
          onOpenChange={(open) => {
            // Once the fee is being charged, the intro stays until the lesson opens.
            if (starting !== "legendary") setLegendary((choice) => ({ ...choice, open }));
          }}
          node={node}
          gems={me.data.gems}
          starting={starting === "legendary"}
          onStart={() => node && begin({ kind: "legendary", nodeId: node.id })}
        />
      </>
    );
  }
  const error = me.error ?? path.error;
  if (error) throw error;
  return <PracticeSkeleton />;
}
