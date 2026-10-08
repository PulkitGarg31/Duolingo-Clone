import type { MeOut } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { FlagStat } from "./FlagStat";
import { GemsStat } from "./GemsStat";
import { HeartsStat } from "./HeartsStat";
import type { StatPlacement } from "./StatPopover";
import { StreakStat } from "./StreakStat";
import { XpPill } from "./XpPill";

interface StatsBarProps {
  me: MeOut;
  placement: StatPlacement;
  className?: string;
}

/** The learner's numbers, in Duolingo's order plus XP: flag · streak · XP · gems · hearts. */
export function StatsBar({ me, placement, className }: StatsBarProps) {
  return (
    <div className={cn("flex items-center justify-between", className)}>
      <FlagStat placement={placement} course={me.course} />
      <StreakStat placement={placement} streak={me.streak} today={me.localDate} joinedAt={me.user.joinedAt} />
      <XpPill placement={placement} totalXp={me.xp.total} dailyGoal={me.dailyGoal} />
      <GemsStat placement={placement} gems={me.gems} />
      <HeartsStat placement={placement} hearts={me.hearts} gems={me.gems} />
    </div>
  );
}
