"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useMe, useQuests } from "@/lib/queries/hooks";
import { qk } from "@/lib/queries/keys";
import { QuestsSkeleton } from "./QuestsSkeleton";
import { QuestsView } from "./QuestsView";

/**
 * /quests. At local midnight the quests and the daily goal start over, so both are fetched again then. A failed
 * first load goes to the route's error boundary.
 */
export function QuestsPage() {
  const quests = useQuests();
  const me = useMe();
  const queryClient = useQueryClient();

  const refreshAfterMidnight = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: qk.quests });
    void queryClient.invalidateQueries({ queryKey: qk.me, exact: true });
  }, [queryClient]);

  if (quests.data && me.data) {
    return <QuestsView quests={quests.data} dailyGoal={me.data.dailyGoal} onReset={refreshAfterMidnight} />;
  }
  const error = quests.error ?? me.error;
  if (error) throw error;
  return <QuestsSkeleton />;
}
