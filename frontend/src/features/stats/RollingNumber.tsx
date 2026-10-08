"use client";

import { AnimatePresence, motion } from "motion/react";
import { formatTotal } from "@/lib/format";

/**
 * A stat number that rolls like a slot machine when it changes: the old value slides up and out while the
 * new one rises in (300 ms). The first value appears without moving.
 */
export function RollingNumber({ value }: { value: number }) {
  return (
    <span className="relative inline-flex overflow-hidden">
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={value}
          initial={{ y: "100%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "-100%", opacity: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        >
          {formatTotal(value)}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
