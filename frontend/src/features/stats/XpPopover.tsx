import { ButtonLink } from "@/components/ui";
import { QuestBar } from "@/features/rail/QuestBar";
import type { DailyGoalOut } from "@/lib/api/types";
import { formatTotal } from "@/lib/format";

interface XpPopoverProps {
  totalXp: number;
  dailyGoal: DailyGoalOut;
  onClose: () => void;
}

/** Today's progress toward the daily goal, the all-time XP total and a shortcut to change the goal. */
export function XpPopover({ totalXp, dailyGoal, onClose }: XpPopoverProps) {
  const { earnedXp, goalXp, met } = dailyGoal;
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-heading text-fg">Daily goal</h2>
      <QuestBar progress={earnedXp} target={goalXp} unit="XP" aria-label="Daily goal" />
      <p className="text-body text-fg-2">
        {met ? "Daily goal complete! Nice work!" : `Earn ${goalXp - earnedXp} more XP to reach your daily goal`}
      </p>
      <div className="flex items-center justify-between border-t-2 border-line pt-4">
        <span className="text-body text-fg">Total XP</span>
        <span className="text-[17px] leading-5 font-extrabold text-xp-fg tabular-nums">{formatTotal(totalXp)}</span>
      </div>
      <ButtonLink href="/settings#daily-goal" variant="ghost" size="inline" className="self-start" onClick={onClose}>
        Edit goal
      </ButtonLink>
    </div>
  );
}
