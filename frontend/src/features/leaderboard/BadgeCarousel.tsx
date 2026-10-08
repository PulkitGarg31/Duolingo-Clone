import { LeagueBadge } from "@/components/icons/LeagueBadge";
import type { LeagueTierOut } from "@/lib/api/types";

/** The current badge is 80 px wide; every other one is 52 px with a 28 px gap, so badges sit 80 px apart. */
const CURRENT_WIDTH = 80;
const SMALL_WIDTH = 52;
const PITCH = 80;

interface BadgeCarouselProps {
  tiers: readonly LeagueTierOut[];
  currentTier: number;
}

/**
 * All ten league badges in a row, the current one large and centred, the edges fading out. Leagues reached so
 * far are in colour; the rest are grey shields with a keyhole. A league change slides the row.
 */
export function BadgeCarousel({ tiers, currentTier }: BadgeCarouselProps) {
  const offset = Math.max(0, tiers.findIndex((tier) => tier.tier === currentTier));
  return (
    <div
      aria-hidden="true"
      className="relative h-[91px] overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_15%,#000_85%,transparent)]"
    >
      <div
        className="absolute inset-y-0 flex items-center gap-7 transition-[left] duration-500 ease-out"
        style={{ left: `calc(50% - ${CURRENT_WIDTH / 2}px - ${offset * PITCH}px)` }}
      >
        {tiers.map(({ tier, reached }) => (
          <LeagueBadge
            key={tier}
            tier={tier}
            locked={!reached}
            size={tier === currentTier ? CURRENT_WIDTH : SMALL_WIDTH}
            className="shrink-0"
          />
        ))}
      </div>
    </div>
  );
}
