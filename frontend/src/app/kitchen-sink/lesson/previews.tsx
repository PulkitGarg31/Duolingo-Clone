"use client";

import { useReducer, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { LessonScreen } from "@/features/lesson/LessonScreen";
import type { LessonActions, LessonAudio, LessonPending } from "@/features/lesson/playerTypes";
import { useLessonController } from "@/features/lesson/useLessonController";
import type { SessionKind } from "@/lib/api/types";
import { lessonReducer, type LessonState } from "@/lib/lesson/lessonMachine";
import { createFakeLessonApi } from "./fakeLessonApi";
import { ME, makeSession } from "./fixtures";

const IDLE: LessonPending = { quitting: false, refilling: false, restarting: false };
const ignore = () => undefined;

/** Speakers are shown (as on a device with a Spanish voice) but nothing is spoken. */
const SILENT_AUDIO: LessonAudio = { available: true, promptPlaying: false, playPrompt: ignore, speak: ignore };

/**
 * A fixed player state. The answer can still be edited (tiles fly, cards select, the quit modal opens), but
 * nothing is sent anywhere.
 */
export function StaticPreview({ start, gems }: { start: LessonState; gems: number | null }) {
  const [state, dispatch] = useReducer(lessonReducer, start);
  const actions: LessonActions = {
    draft: (next) => dispatch({ type: "DRAFT_CHANGED", draft: next }),
    tap: ignore,
    check: ignore,
    skip: ignore,
    cantListen: ignore,
    continue: ignore,
    openQuit: () => dispatch({ type: "QUIT_OPEN" }),
    cancelQuit: () => dispatch({ type: "QUIT_CANCEL" }),
    endSession: ignore,
    refill: ignore,
    noThanks: ignore,
    tryAgain: ignore,
    leave: ignore,
    retry: ignore,
    nextCelebration: () => dispatch({ type: "NEXT_CELEBRATION" }),
    timeUp: ignore,
    report: ignore,
    replay: ignore,
  };
  return <LessonScreen state={state} gems={gems} audio={SILENT_AUDIO} actions={actions} pending={IDLE} />;
}

/** A playable session of `kind` against the in-memory server; leaving or TRY AGAIN starts it over. */
export function DemoPreview({ kind }: { kind: SessionKind }) {
  const [run, setRun] = useState(0);
  return <DemoRun key={run} kind={kind} onRestart={() => setRun((count) => count + 1)} />;
}

function DemoRun({ kind, onRestart }: { kind: SessionKind; onRestart(): void }) {
  const { toast } = useToast();
  const [session] = useState(() => makeSession(kind));
  const [api] = useState(() => createFakeLessonApi(session, { onRestart }));
  const { state, actions, audio, pending } = useLessonController({
    session,
    me: ME,
    api,
    navigate: (href) => {
      toast({ message: `The app would now open ${href}` });
      onRestart();
    },
  });
  return <LessonScreen state={state} gems={ME.gems} audio={audio} actions={actions} pending={pending} />;
}
