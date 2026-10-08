import { FlameIcon } from "@/components/icons";
import type { ISODate, ISODateTime, MeStreak } from "@/lib/api/types";
import { formatStreak } from "@/lib/format";
import { StatPopover, type StatPlacement } from "./StatPopover";
import { StreakPopover } from "./StreakPopover";

interface StreakStatProps {
  placement: StatPlacement;
  streak: MeStreak;
  today: ISODate;
  joinedAt: ISODateTime;
}

/** The streak: an orange flame once today's lesson is done, grey until then. */
export function StreakStat({ placement, streak, today, joinedAt }: StreakStatProps) {
  const lit = streak.extendedToday;
  return (
    <StatPopover
      placement={placement}
      title={formatStreak(streak.current)}
      width={380}
      button={{
        "aria-label": formatStreak(streak.current),
        icon: <FlameIcon variant={lit ? "active" : "inactive"} size={28} />,
        count: streak.current,
        countClassName: lit ? "text-streak" : "text-streak-off",
      }}
    >
      {(close) => <StreakPopover streak={streak} today={today} joinedOn={joinedAt.slice(0, 10)} onClose={close} />}
    </StatPopover>
  );
}
