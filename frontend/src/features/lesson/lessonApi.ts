"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { getSession } from "@/lib/api/endpoints";
import type { AnswerIn, AnswerResultOut, CompletionOut, PurchaseOut, QuitOut, SessionOut } from "@/lib/api/types";
import { qk } from "@/lib/queries/keys";
import {
  useCompleteSession,
  usePurchase,
  useQuitSession,
  useStartSession,
  useSubmitAnswer,
} from "@/lib/queries/mutations";

/**
 * The server calls the lesson player makes. Every promise rejects with an ApiError. The app uses the real
 * API below; the preview pages plug in an in-memory one.
 */
export interface LessonApi {
  submitAnswer(sessionId: number, itemId: number, answer: AnswerIn): Promise<AnswerResultOut>;
  complete(sessionId: number): Promise<CompletionOut>;
  quit(sessionId: number): Promise<QuitOut>;
  /** Buys full hearts. `idempotencyKey` belongs to one click: a retried request never charges twice. */
  refillHearts(idempotencyKey: string): Promise<PurchaseOut>;
  /** The session as the server sees it now. */
  reload(sessionId: number): Promise<SessionOut>;
  /** Starts a new Legendary run on a node and opens it in place of this one. */
  startLegendary(nodeId: number): Promise<SessionOut>;
}

/** The lesson API on top of the app's mutations, so their cache updates (hearts, gems, `me`) apply. */
export function useLessonApi(): LessonApi {
  const queryClient = useQueryClient();
  const { mutateAsync: submit } = useSubmitAnswer();
  const { mutateAsync: complete } = useCompleteSession();
  const { mutateAsync: quit } = useQuitSession();
  const { mutateAsync: purchase } = usePurchase();
  const { mutateAsync: start } = useStartSession({ replace: true });
  return useMemo(
    () => ({
      submitAnswer: (sessionId, itemId, answer) => submit({ sessionId, itemId, answer }),
      complete: (sessionId) => complete(sessionId),
      quit: (sessionId) => quit(sessionId),
      refillHearts: (idempotencyKey) => purchase({ itemCode: "heart_refill", idempotencyKey }),
      reload: (sessionId) =>
        queryClient.fetchQuery({ queryKey: qk.session(sessionId), queryFn: () => getSession(sessionId), staleTime: 0 }),
      startLegendary: (nodeId) => start({ kind: "legendary", nodeId }),
    }),
    [queryClient, submit, complete, quit, purchase, start],
  );
}
