"use client";

import { motion } from "motion/react";
import { ChestIcon } from "@/components/icons/ChestIcon";
import { cn } from "@/lib/cn";

/**
 * The reward chest at the end of a quest bar. It opens with a gold glow once the reward is paid, with a little
 * bounce when that happens while the page is open.
 */
export function QuestChest({ open, size }: { open: boolean; size: number }) {
  return (
    <motion.span
      initial={false}
      animate={{ scale: open ? [1, 1.2, 1] : 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className={cn("block", open && "drop-shadow-[0_0_4px_rgb(255_200_0/0.75)]")}
    >
      <ChestIcon variant={open ? "open" : "closed"} size={size} title={open ? "Reward collected" : "Reward"} />
    </motion.span>
  );
}
