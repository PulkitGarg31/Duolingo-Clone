"use client";

import { motion } from "motion/react";
import { FlameIcon } from "@/components/icons/FlameIcon";
import type { ProgressTone } from "@/components/ui/ProgressBar";
import { cn } from "@/lib/cn";

/** The bar turns gold at 6 correct answers in a row and orange at 11. */
export function comboTone(combo: number): ProgressTone {
  if (combo >= 11) return "fire";
  if (combo >= 6) return "hot";
  return "fill";
}

/** The label takes the colour of the bar it sits on. */
const INK: Partial<Record<ProgressTone, string>> = {
  fill: "text-fill",
  hot: "text-fill-hot",
  fire: "text-fill-fire",
  gold: "text-fill-hot",
  beetle: "text-beetle",
};

/** "5 IN A ROW" with a small flame, just above the left end of the progress bar. */
export function ComboLabel({ combo, tone }: { combo: number; tone: ProgressTone }) {
  return (
    <motion.p
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, transition: { duration: 0.15 } }}
      transition={{ duration: 0.2, ease: [0, 0, 0.2, 1] }}
      className={cn("absolute bottom-[calc(100%+4px)] left-0 flex items-center gap-1 text-caption whitespace-nowrap uppercase", INK[tone])}
    >
      <FlameIcon variant="mono" size={14} />
      {combo} in a row
    </motion.p>
  );
}
