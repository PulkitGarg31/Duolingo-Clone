"use client";

import { HeartIcon } from "@/components/icons";
import { useComingSoon } from "@/features/shell/ComingSoon";
import type { HeartsOut } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { HeartsPopover } from "./HeartsPopover";
import { StatPopover, type StatPlacement } from "./StatPopover";
import { useHeartActions } from "./useHeartActions";

interface HeartsStatProps {
  placement: StatPlacement;
  hearts: HeartsOut;
  gems: number;
}

/** Hearts left: red, or a grey heart and a grey 0 when they have run out. */
export function HeartsStat({ placement, hearts, gems }: HeartsStatProps) {
  const actions = useHeartActions();
  const showComingSoon = useComingSoon();
  const empty = hearts.current === 0;
  return (
    <StatPopover
      placement={placement}
      title="Hearts"
      width={380}
      panelClassName="px-3"
      button={{
        "aria-label": `${hearts.current} of ${hearts.max} hearts`,
        icon: <HeartIcon variant={empty ? "empty" : "full"} size={28} />,
        count: hearts.current,
        countClassName: empty ? "text-fg-3" : "text-heart",
        // The top bar keeps the hearts item wide enough not to jump as the count changes.
        className: cn(placement === "topbar" && "min-w-[72px] max-[25rem]:min-w-14"),
      }}
    >
      {(close) => (
        <HeartsPopover
          hearts={hearts}
          gems={gems}
          refilling={actions.refilling}
          practicing={actions.practicing}
          onRefill={() => actions.refill()}
          onPractice={actions.practice}
          onUnlimited={() => {
            close();
            showComingSoon("Unlimited Hearts");
          }}
        />
      )}
    </StatPopover>
  );
}
