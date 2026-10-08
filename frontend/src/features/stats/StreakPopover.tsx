import { FlameIcon, FreezeIcon, type FlameVariant } from "@/components/icons";
import { ButtonLink } from "@/components/ui";
import type { ISODate, MeStreak } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { StreakCalendarCard } from "./StreakCalendarCard";

/** The heading panel's look: orange once today counts, blue after a frozen day, cream until then. */
type HeadingState = "extended" | "frozen" | "pending";

const HEADING: Record<HeadingState, { panel: string; flame: FlameVariant }> = {
  extended: { panel: "bg-(--c-streak-panel-on-bg) text-on-color-fixed", flame: "perfect" },
  frozen: { panel: "bg-(--c-streak-panel-frozen-bg) text-fg-selected dark:text-on-color-fixed", flame: "frozen" },
  pending: { panel: "bg-(--c-streak-panel-off-bg) text-(--c-streak-panel-off-fg)", flame: "inactive" },
};

function headingState(streak: MeStreak): HeadingState {
  if (streak.extendedToday) return "extended";
  return streak.frozenYesterday ? "frozen" : "pending";
}

function streakMessage(streak: MeStreak): string {
  if (streak.extendedToday) return "You extended your streak today!";
  if (streak.current === 0) return "Do a lesson today to start a new streak!";
  if (streak.frozenYesterday) return "Streak frozen yesterday. Extend your streak now!";
  return "Do a lesson today to extend your streak!";
}

interface StreakPopoverProps {
  streak: MeStreak;
  today: ISODate;
  /** The learner's join date, the calendar's first month. */
  joinedOn: ISODate;
  onClose: () => void;
}

/** The streak details: the count on a panel coloured by today's status, the month calendar and the freezes. */
export function StreakPopover({ streak, today, joinedOn, onClose }: StreakPopoverProps) {
  const heading = HEADING[headingState(streak)];
  return (
    <div className="flex flex-col gap-4">
      <div className={cn("flex items-center justify-between rounded-md px-5 py-4", heading.panel)}>
        <div>
          <p className="text-[40px] leading-[44px] font-black tabular-nums">{streak.current}</p>
          <p className="text-[17px] leading-5 font-extrabold">day streak</p>
        </div>
        <FlameIcon variant={heading.flame} size={64} />
      </div>
      <p className="text-body text-fg-2">{streakMessage(streak)}</p>
      <StreakCalendarCard today={today} firstMonthDate={joinedOn} />
      <div className="flex items-center gap-3">
        <FreezeIcon size={32} />
        <p className="flex-1 text-body text-fg">
          {streak.freezesEquipped} / {streak.maxFreezes} Streak Freezes equipped
        </p>
        <ButtonLink href="/shop" variant="ghost" size="inline" onClick={onClose}>
          Get more
        </ButtonLink>
      </div>
    </div>
  );
}
