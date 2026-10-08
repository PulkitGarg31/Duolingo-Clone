"use client";

import { motion } from "motion/react";

/** Where the three sparkles pop, around the 70 × 57 face (px from its top-left corner). */
const SPARKLES = [
  { left: -10, top: -6, size: 14, delay: 0 },
  { left: 66, top: -12, size: 18, delay: 0.15 },
  { left: 74, top: 30, size: 12, delay: 0.3 },
] as const;

/**
 * Three gold sparkles that twinkle once around a Legendary node when the path appears. Decorative, and
 * skipped under reduced motion (Motion leaves them at their final, invisible state).
 */
export function LegendarySparkles() {
  return (
    <span aria-hidden="true" className="pointer-events-none absolute inset-0 z-[2]">
      {SPARKLES.map(({ left, top, size, delay }) => (
        <motion.svg
          key={`${left}-${top}`}
          width={size}
          height={size}
          viewBox="0 0 10 10"
          className="absolute"
          style={{ left, top }}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: [0, 1.2, 0], opacity: [0, 1, 0] }}
          transition={{ duration: 0.6, delay: 0.2 + delay, ease: "easeOut" }}
        >
          <path d="M5 0.6 6.1 3.9 9.4 5 6.1 6.1 5 9.4 3.9 6.1 0.6 5 3.9 3.9Z" fill="var(--unit-gold)" stroke="var(--unit-gold-lip)" strokeWidth={0.6} strokeLinejoin="round" />
        </motion.svg>
      ))}
    </span>
  );
}
