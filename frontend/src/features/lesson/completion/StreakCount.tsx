import { cn } from "@/lib/cn";

interface StreakCountProps {
  from: number;
  to: number;
  /** Time to roll: the old count slides up and out while the new one rises into its place. */
  rolled: boolean;
}

/**
 * The giant streak number (the `display` role: 120/120, 96 on phones). Both counts share one grid cell, so
 * the box always fits the wider of the two and clips them as they roll.
 */
export function StreakCount({ from, to, rolled }: StreakCountProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid overflow-hidden text-[96px]/none font-black tracking-[-0.02em] text-streak tabular-nums",
        "md:text-display",
      )}
    >
      <span className={cn("col-start-1 row-start-1", rolled && "animate-[roll-out_300ms_ease-in_forwards]")}>
        {from}
      </span>
      {rolled && <span className="col-start-1 row-start-1 animate-[roll-in_300ms_ease-out_both]">{to}</span>}
    </span>
  );
}
