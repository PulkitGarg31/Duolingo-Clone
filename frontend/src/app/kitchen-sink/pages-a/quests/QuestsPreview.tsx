"use client";

import { useSyncExternalStore } from "react";
import { QuestsSkeleton } from "@/features/quests/QuestsSkeleton";
import { QuestsView } from "@/features/quests/QuestsView";
import { QUEST_STATES } from "../fixtures";
import { PreviewFrame, pickState } from "../PreviewFrame";

/** Nothing to observe: the snapshot only tells the server render and hydration apart from later renders. */
function subscribeToNothing(): () => void {
  return () => undefined;
}

/** The quests page from a fresh day to every quest done. */
export function QuestsPreview({ requested }: { requested?: string }) {
  const { fixture, current } = pickState(QUEST_STATES, requested);
  const { quests, me } = QUEST_STATES[fixture];
  // The fixtures' deadlines are fixed when their module loads, which on a long-running dev server is hours
  // before the browser loads it, so the countdowns would disagree with the server's HTML. The server sends
  // the skeleton and the view renders only in the browser.
  const inBrowser = useSyncExternalStore(subscribeToNothing, () => true, () => false);
  return (
    <PreviewFrame title="Quests" states={Object.keys(QUEST_STATES)} current={current} skeleton={<QuestsSkeleton />}>
      {inBrowser ? <QuestsView quests={quests} dailyGoal={me.dailyGoal} /> : <QuestsSkeleton />}
    </PreviewFrame>
  );
}
