"use client";

import { useState } from "react";
import { useToast } from "@/components/ui";
import { LegendaryIntroModal } from "@/features/path/LegendaryIntroModal";
import { PracticeHub } from "@/features/practice/PracticeHub";
import { PracticeSkeleton } from "@/features/practice/PracticeSkeleton";
import { TimedIntro } from "@/features/practice/TimedIntro";
import type { PathNodeOut, SessionKind } from "@/lib/api/types";
import { PRACTICE_STATES } from "../fixtures";
import { PreviewFrame, pickState } from "../PreviewFrame";

/** How long the pretend session start takes, long enough to see the loading states. */
const FAKE_REQUEST_MS = 1_200;

/**
 * The practice hub for the sample learner, with full hearts, short of gems and brand new. Starting anything
 * pretends to create the session and toasts instead of opening a lesson.
 */
export function PracticePreview({ requested }: { requested?: string }) {
  const { fixture, current } = pickState(PRACTICE_STATES, requested);
  const { me, path } = PRACTICE_STATES[fixture];
  const { toast } = useToast();
  const [starting, setStarting] = useState<SessionKind | null>(null);
  const [timedOpen, setTimedOpen] = useState(false);
  const [legendary, setLegendary] = useState<{ node: PathNodeOut | null; open: boolean }>({ node: null, open: false });

  function pretendToStart(kind: SessionKind) {
    setStarting(kind);
    setTimeout(() => {
      setStarting(null);
      setTimedOpen(false);
      setLegendary((choice) => ({ ...choice, open: false }));
      toast({ tone: "info", message: `A ${kind} session would open the lesson player now.` });
    }, FAKE_REQUEST_MS);
  }

  return (
    <PreviewFrame
      title="Practice"
      states={Object.keys(PRACTICE_STATES)}
      current={current}
      skeleton={<PracticeSkeleton />}
    >
      <PracticeHub
        me={me}
        path={path}
        practiceStarting={starting === "practice"}
        onEarnHearts={() => pretendToStart("practice")}
        onTimed={() => setTimedOpen(true)}
        onLegendary={(node) => setLegendary({ node, open: true })}
      />
      <TimedIntro
        open={timedOpen}
        starting={starting === "timed"}
        onStart={() => pretendToStart("timed")}
        onClose={() => setTimedOpen(false)}
      />
      <LegendaryIntroModal
        open={legendary.open}
        onOpenChange={(open) => setLegendary((choice) => ({ ...choice, open }))}
        node={legendary.node}
        gems={me.gems}
        starting={starting === "legendary"}
        onStart={() => pretendToStart("legendary")}
      />
    </PreviewFrame>
  );
}
