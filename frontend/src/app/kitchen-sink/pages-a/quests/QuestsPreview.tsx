"use client";

import { QuestsSkeleton } from "@/features/quests/QuestsSkeleton";
import { QuestsView } from "@/features/quests/QuestsView";
import { QUEST_STATES } from "../fixtures";
import { PreviewFrame, pickState } from "../PreviewFrame";

/** The quests page from a fresh day to every quest done. */
export function QuestsPreview({ requested }: { requested?: string }) {
  const { fixture, current } = pickState(QUEST_STATES, requested);
  const { quests, me } = QUEST_STATES[fixture];
  return (
    <PreviewFrame title="Quests" states={Object.keys(QUEST_STATES)} current={current} skeleton={<QuestsSkeleton />}>
      <QuestsView quests={quests} dailyGoal={me.dailyGoal} />
    </PreviewFrame>
  );
}
