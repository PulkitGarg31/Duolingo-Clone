"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { cn } from "@/lib/cn";

/** -1: the number went down (the old one drops out, the new one comes in from above); 1: it went up. */
type Direction = -1 | 1;

const ROLL = {
  enter: (direction: Direction) => ({ y: direction < 0 ? "-100%" : "100%", opacity: 0 }),
  center: { y: 0, opacity: 1 },
  exit: (direction: Direction) => ({ y: direction < 0 ? "100%" : "-100%", opacity: 0 }),
};

/** A counter whose digits roll to the new value (300 ms) instead of jumping. */
export function RollingNumber({ value, className }: { value: number; className?: string }) {
  const [previous, setPrevious] = useState(value);
  const [direction, setDirection] = useState<Direction>(-1);
  if (value !== previous) {
    setPrevious(value);
    setDirection(value < previous ? -1 : 1);
  }
  return (
    <span className={cn("relative inline-grid overflow-hidden tabular-nums", className)}>
      <AnimatePresence initial={false} custom={direction}>
        <motion.span
          key={value}
          custom={direction}
          variants={ROLL}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          className="col-start-1 row-start-1"
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
