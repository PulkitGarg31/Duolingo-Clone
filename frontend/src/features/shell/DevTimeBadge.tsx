import Link from "next/link";
import { ClockIcon } from "@/components/icons";
import { Pill } from "@/components/ui";
import type { DevInfo } from "@/lib/api/types";
import { formatClockOffset } from "./clockOffset";

/**
 * A reminder that the demo clock runs ahead of real time (after "+5 HOURS" or "NEXT DAY" in the demo tools).
 * It links back to those tools. Hidden while the clock is real.
 */
export function DevTimeBadge({ dev }: { dev: DevInfo | null }) {
  if (!dev || dev.clockOffsetSeconds <= 0) return null;
  const offset = formatClockOffset(dev.clockOffsetSeconds);
  return (
    <Link
      href="/settings#demo-tools"
      aria-label={`Simulated time: real time ${offset}. Open the demo tools`}
      className="fixed bottom-[calc(94px+env(safe-area-inset-bottom))] left-3 z-(--z-dev) inline-flex items-center gap-2 rounded-full border-2 border-line bg-page py-1 pr-3 pl-1 shadow-[0_2px_0_var(--c-line)] hover:bg-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus lg:bottom-4 lg:left-4"
    >
      <Pill tone="beetle">Dev</Pill>
      <ClockIcon size={16} className="text-fg-3" />
      <span className="text-[13px] leading-4 font-extrabold text-fg-2 tabular-nums">{offset}</span>
    </Link>
  );
}
