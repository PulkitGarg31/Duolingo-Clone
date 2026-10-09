import Link from "next/link";
import { ClockIcon } from "@/components/icons";
import { Pill } from "@/components/ui";
import { formatClockOffset } from "./clockOffset";

/**
 * A reminder that the demo clock runs ahead of real time (after "+5 HOURS" or "NEXT DAY" in the demo tools),
 * linking back to those tools; the shell decides where it shows (`showsDevTimeBadge`). It floats above the
 * phone's tab bar, beside the 88 px icon rail (it is wider than the rail), and in the empty foot of the
 * labelled sidebar.
 */
export function DevTimeBadge({ offsetSeconds }: { offsetSeconds: number }) {
  const offset = formatClockOffset(offsetSeconds);
  return (
    <Link
      href="/settings#demo-tools"
      aria-label={`Simulated time: real time ${offset}. Open the demo tools`}
      className="fixed bottom-[calc(94px+env(safe-area-inset-bottom))] left-3 z-(--z-dev) inline-flex items-center gap-2 rounded-full border-2 border-line bg-page py-1 pr-3 pl-1 shadow-[0_2px_0_var(--c-line)] hover:bg-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus lg:bottom-4 lg:left-[calc(var(--rail-w)+16px)] 2xl:left-4"
    >
      <Pill tone="beetle">Dev</Pill>
      <ClockIcon size={16} className="text-fg-3" />
      <span className="text-[13px] leading-4 font-extrabold text-fg-2 tabular-nums">{offset}</span>
    </Link>
  );
}
