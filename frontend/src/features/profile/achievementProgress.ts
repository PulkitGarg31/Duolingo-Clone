import type { AchievementOut } from "@/lib/api/types";
import { formatTotal } from "@/lib/format";

export interface AchievementProgress {
  /** Bar fill from 0 to 1. */
  value: number;
  /** "13/14": the live value against the next level's threshold. */
  counter: string;
  /** Every level is earned: the tile turns gold and the bar stays full. */
  maxed: boolean;
}

/**
 * Progress towards an achievement's next level. At the top level there is nothing left to count towards, so
 * the bar is full and the counter shows the last threshold reached ("1/1").
 */
export function achievementProgress(achievement: AchievementOut): AchievementProgress {
  const { currentValue, nextThreshold, tiers } = achievement;
  const maxed = nextThreshold === null;
  const target = nextThreshold ?? tiers.at(-1)?.threshold ?? currentValue;
  const reached = Math.min(currentValue, target);
  return {
    value: maxed || target === 0 ? 1 : reached / target,
    counter: `${formatTotal(reached)}/${formatTotal(target)}`,
    maxed,
  };
}
