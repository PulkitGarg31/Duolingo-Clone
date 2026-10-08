"use client";

import { motion } from "motion/react";
import { ArrowIcon } from "@/components/icons/ArrowIcon";
import { cn } from "@/lib/cn";
import { ROW_LAYOUT_TRANSITION } from "./rowMotion";

const ZONES = {
  promotion: { label: "Promotion zone", direction: "up", color: "text-(--c-lb-up-fg)" },
  demotion: { label: "Demotion zone", direction: "down", color: "text-(--c-lb-down-fg)" },
} as const;

/** The line between zones: green up arrows under the last rank that advances, red down arrows above the first that drops. */
export function ZoneDivider({ zone }: { zone: keyof typeof ZONES }) {
  const { label, direction, color } = ZONES[zone];
  return (
    <motion.li
      layout="position"
      transition={ROW_LAYOUT_TRANSITION}
      role="separator"
      aria-label={label}
      className={cn("flex items-center justify-center gap-[15px] py-[15px] text-label uppercase", color)}
    >
      <ArrowIcon direction={direction} size={16} />
      {label}
      <ArrowIcon direction={direction} size={16} />
    </motion.li>
  );
}
