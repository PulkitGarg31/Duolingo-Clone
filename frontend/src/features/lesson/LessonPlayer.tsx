"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { isApiError, type ApiError } from "@/lib/api/errors";
import type { MeOut, SessionOut } from "@/lib/api/types";
import { SESSION_ENDED_NOTICE } from "@/lib/lesson/lessonMachine";
import { useMe, useSession } from "@/lib/queries/hooks";
import { ErrorNotice } from "./body/ErrorNotice";
import { useLessonApi } from "./lessonApi";
import { LessonScreen } from "./LessonScreen";
import { LessonSkeleton } from "./LessonSkeleton";
import { useBackToQuit } from "./useBackToQuit";
import { useLessonController } from "./useLessonController";

/**
 * The lesson route's container. The session is fetched fresh on every visit (a refresh or the back button
 * resumes where the server says), and the lesson starts from the first settled copy; later refetches never
 * restart it. A session the server no longer has sends the learner back to the path.
 */
export function LessonPlayer({ sessionId }: { sessionId: number }) {
  const session = useSession(sessionId);
  const me = useMe();
  const [start, setStart] = useState<SessionOut | null>(null);
  if (start === null && session.isSuccess && !session.isFetching && !me.isPending) setStart(session.data);

  const gone = isApiError(session.error, "NOT_FOUND");
  useLeaveWhen(gone);

  if (start) return <LessonRun session={start} me={me.data ?? null} />;
  if (session.isError && !gone) return <LessonLoadError error={session.error} onRetry={() => void session.refetch()} />;
  return <LessonSkeleton />;
}

function LessonRun({ session, me }: { session: SessionOut; me: MeOut | null }) {
  const router = useRouter();
  const api = useLessonApi();
  const { state, actions, audio, pending } = useLessonController({
    session,
    me,
    api,
    navigate: (href) => router.replace(href),
  });
  // Back asks before quitting a lesson in progress; once it is over, back simply leaves.
  useBackToQuit(() => (state.phase.name === "celebrating" ? actions.leave() : actions.openQuit()));
  return <LessonScreen state={state} gems={me?.gems ?? null} audio={audio} actions={actions} pending={pending} />;
}

/** "This session has ended", then the path: for a session the server does not know (a restart wiped it). */
function useLeaveWhen(gone: boolean) {
  const router = useRouter();
  const { toast } = useToast();
  const left = useRef(false);
  useEffect(() => {
    if (!gone || left.current) return;
    left.current = true;
    toast({ message: SESSION_ENDED_NOTICE });
    router.replace("/learn");
  }, [gone, router, toast]);
}

/** The session could not be loaded (other than "not found"): try again, or go back to the path. */
function LessonLoadError({ error, onRetry }: { error: ApiError; onRetry(): void }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-page px-4">
      <ErrorNotice error={error} />
      <div className="mt-4 grid w-full max-w-[280px] gap-2">
        <Button onClick={onRetry}>Try again</Button>
        <ButtonLink href="/learn" variant="ghost">
          Back to learning
        </ButtonLink>
      </div>
    </div>
  );
}
