import { ProgressBar } from "@/components/ui";

interface QuestBarProps {
  progress: number;
  target: number;
  /** Follows the count, as in "12 / 20 XP". */
  unit?: string;
  "aria-label": string;
}

/** A gold quest bar with its count ("12 / 20") centred inside, on the rail and in the daily goal popover. */
export function QuestBar({ progress, target, unit, "aria-label": ariaLabel }: QuestBarProps) {
  const value = target > 0 ? progress / target : 0;
  const count = unit ? `${progress} / ${target} ${unit}` : `${progress} / ${target}`;
  return <ProgressBar value={value} tone="quest" height={18} label={count} aria-label={ariaLabel} />;
}
