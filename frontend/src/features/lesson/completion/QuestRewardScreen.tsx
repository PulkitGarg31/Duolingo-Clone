"use client";

import type { QuestCompletedOut } from "@/lib/api/types";
import { questRewardCopy } from "@/lib/lesson/copy";
import { CelebrationFooter } from "./CelebrationFooter";
import { CelebrationScreen } from "./CelebrationScreen";
import { useSoundOnce } from "./celebrationSound";
import { CelebrationBody, CelebrationTitle } from "./CelebrationText";
import { RewardChest } from "./RewardChest";
import { useCues } from "./useCues";

/** The chest wiggles twice (600 ms), then opens. */
const QUEST_CUES = [600] as const;

interface QuestRewardScreenProps {
  quests: readonly QuestCompletedOut[];
  active: boolean;
  onContinue: () => void;
}

/** "You earned 10 gems!": one screen for every quest the session completed, with their gems added up. */
export function QuestRewardScreen({ quests, active, onContinue }: QuestRewardScreenProps) {
  const cue = useCues(QUEST_CUES);
  const copy = questRewardCopy(quests);
  useSoundOnce("gems", cue >= 1);
  return (
    <CelebrationScreen footer={<CelebrationFooter active={active} onContinue={onContinue} />}>
      <RewardChest open={cue >= 1} />
      <CelebrationTitle className="mt-8 text-fg-strong">{copy.title}</CelebrationTitle>
      <CelebrationBody className="mt-3 max-w-[400px] text-fg-2">{copy.body}</CelebrationBody>
    </CelebrationScreen>
  );
}
