"use client";

import { motion } from "motion/react";
import { ChestIcon, GemChestIcon, GemIcon } from "@/components/icons";
import { EASE_OUT } from "@/components/ui/transitions";
import { useTheme } from "@/lib/theme/ThemeProvider";

/** Where each gem flies to from the chest's mouth (px) and when it leaves (s). */
const GEM_FLIGHTS = [
  { x: -92, y: -58, delay: 0 },
  { x: -50, y: -104, delay: 0.06 },
  { x: 2, y: -124, delay: 0.12 },
  { x: 54, y: -102, delay: 0.18 },
  { x: 94, y: -54, delay: 0.24 },
] as const;

const FLIGHT_SECONDS = 0.9;

/**
 * A treasure chest that wiggles, then bursts open with gems flying out. The closed and open drawings put the
 * chest at the same place, so opening swaps one for the other without a jump.
 */
export function RewardChest({ open }: { open: boolean }) {
  const { reducedMotion } = useTheme();
  return (
    <div className="relative size-40">
      {open ? (
        <div className="animate-[badge-pop_300ms_var(--ease-spring)_both]">
          <GemChestIcon size={160} />
        </div>
      ) : (
        <div className="absolute top-6 left-4 animate-[chest-wiggle_300ms_ease-in-out_2]">
          <ChestIcon size={128} />
        </div>
      )}
      {open &&
        !reducedMotion &&
        GEM_FLIGHTS.map((flight) => (
          <motion.div
            key={flight.x}
            aria-hidden="true"
            className="absolute top-14 left-[66px]"
            initial={{ x: 0, y: 0, scale: 0.4, opacity: 0 }}
            animate={{ x: flight.x, y: flight.y, scale: 1, opacity: [0, 1, 1, 0] }}
            transition={{
              duration: FLIGHT_SECONDS,
              delay: flight.delay,
              ease: EASE_OUT,
              opacity: { duration: FLIGHT_SECONDS, delay: flight.delay, times: [0, 0.15, 0.7, 1] },
            }}
          >
            <GemIcon size={28} />
          </motion.div>
        ))}
    </div>
  );
}
