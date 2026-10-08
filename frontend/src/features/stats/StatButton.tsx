"use client";

import { motion } from "motion/react";
import type { ComponentProps, ReactNode } from "react";
import { useValueChange } from "@/features/shell/useValueChange";
import { cn } from "@/lib/cn";
import { RollingNumber } from "./RollingNumber";

export interface StatButtonProps extends ComponentProps<"button"> {
  icon: ReactNode;
  /** The stat's number. A new value rolls in and the icon pops. The course flag has none. */
  count?: number;
  /** The number's colour, e.g. `text-streak` or `text-fg-3` when inactive. */
  countClassName?: string;
  /** The phone top bar squeezes five stats into 320 px: tighter padding below 400 px, smaller icons below 360. */
  compact?: boolean;
}

/** One item of the stats row: a 44 px button with an icon and a number. Always label it with `aria-label`. */
export function StatButton({ icon, count, countClassName, compact = false, className, ...rest }: StatButtonProps) {
  const change = useValueChange(count);
  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-11 shrink-0 cursor-pointer items-center gap-2 rounded-md px-2 outline-none",
        "hover:bg-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
        "data-[state=open]:bg-subtle",
        // Only icons drawn directly in the icon slot shrink; composite icons (the XP ring) scale themselves.
        compact && "max-[25rem]:gap-1 max-[25rem]:px-1 max-xs:[&>span>svg]:size-6",
        className,
      )}
      {...rest}
    >
      <motion.span
        key={change.count}
        className="inline-flex"
        initial={change.count > 0 ? { scale: 1.2 } : false}
        animate={{ scale: 1 }}
        transition={{ duration: 0.2 }}
      >
        {icon}
      </motion.span>
      {count !== undefined && (
        <span className={cn("text-stat tabular-nums", countClassName)}>
          <RollingNumber value={count} />
        </span>
      )}
    </button>
  );
}
