import { BoltIcon } from "@/components/icons";
import { ProgressRing } from "@/components/ui";
import type { DailyGoalOut } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { StatPopover, type StatPlacement } from "./StatPopover";
import { XpPopover } from "./XpPopover";

interface XpPillProps {
  placement: StatPlacement;
  totalXp: number;
  dailyGoal: DailyGoalOut;
}

/**
 * Total XP, with the daily goal as a thin gold ring around the bolt: the goal indicator stays visible at
 * every width, including phones, where the rail and its quest card are hidden.
 */
export function XpPill({ placement, totalXp, dailyGoal }: XpPillProps) {
  const goalProgress = Math.min(1, dailyGoal.earnedXp / dailyGoal.goalXp);
  return (
    <StatPopover
      placement={placement}
      title="Daily goal"
      width={320}
      button={{
        "aria-label": `${totalXp} total XP, ${dailyGoal.earnedXp} of ${dailyGoal.goalXp} XP daily goal`,
        icon: (
          <ProgressRing
            value={goalProgress}
            size={32}
            stroke={2}
            color="var(--c-xp)"
            // The ring is 28 px in the top bar of the narrowest phones.
            className={cn(placement === "topbar" && "max-xs:scale-[0.875]")}
          >
            <BoltIcon size={20} />
          </ProgressRing>
        ),
        count: totalXp,
        countClassName: "text-xp-fg",
      }}
    >
      {(close) => <XpPopover totalXp={totalXp} dailyGoal={dailyGoal} onClose={close} />}
    </StatPopover>
  );
}
