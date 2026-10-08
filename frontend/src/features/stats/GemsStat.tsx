import { GemIcon } from "@/components/icons";
import { GemsPopover } from "./GemsPopover";
import { StatPopover, type StatPlacement } from "./StatPopover";

/** Finds the gem stat, where gems from an opened chest fly to. */
export const GEM_COUNTER_SELECTOR = "[data-gem-counter]";

/** The gem balance. */
export function GemsStat({ placement, gems }: { placement: StatPlacement; gems: number }) {
  const any = gems > 0;
  return (
    <StatPopover
      placement={placement}
      title="Gems"
      width={320}
      button={{
        "aria-label": `${gems} gems`,
        "data-gem-counter": "",
        icon: <GemIcon variant={any ? "active" : "inactive"} size={28} />,
        count: gems,
        countClassName: any ? "text-gem" : "text-fg-3",
      }}
    >
      {(close) => <GemsPopover gems={gems} onClose={close} />}
    </StatPopover>
  );
}
