"use client";

import { motion } from "motion/react";
import { createPortal } from "react-dom";
import { GemIcon } from "@/components/icons";

/** Viewport points, in px. */
export interface GemFlight {
  from: { x: number; y: number };
  to: { x: number; y: number };
}

const GEM_COUNT = 8;
const GEM_SIZE = 24;
/** How far the gems scatter around the chest before flying off. */
const SCATTER_PX = 44;
const FLIGHT_SECONDS = 0.7;
const STAGGER_SECONDS = 0.04;

/**
 * Eight gems burst out of an opened chest and fly to the gem counter in the stats row, one after another.
 * Rendered over everything and never in the way of clicks; `onDone` fires when the last gem lands.
 */
export function GemBurst({ flight, onDone }: { flight: GemFlight; onDone: () => void }) {
  const { from, to } = flight;
  return createPortal(
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-(--z-confetti)">
      {Array.from({ length: GEM_COUNT }, (_, index) => {
        const angle = (index / GEM_COUNT) * 2 * Math.PI;
        const scatterX = from.x + Math.cos(angle) * SCATTER_PX;
        const scatterY = from.y + Math.sin(angle) * SCATTER_PX - SCATTER_PX;
        return (
          <motion.span
            key={index}
            className="absolute top-0 left-0"
            style={{ marginLeft: -GEM_SIZE / 2, marginTop: -GEM_SIZE / 2 }}
            initial={{ x: from.x, y: from.y, scale: 0.4, opacity: 0 }}
            animate={{ x: [from.x, scatterX, to.x], y: [from.y, scatterY, to.y], scale: [0.4, 1, 0.7], opacity: [0, 1, 1] }}
            transition={{ duration: FLIGHT_SECONDS, delay: index * STAGGER_SECONDS, times: [0, 0.35, 1], ease: "easeInOut" }}
            onAnimationComplete={index === GEM_COUNT - 1 ? onDone : undefined}
          >
            <GemIcon size={GEM_SIZE} />
          </motion.span>
        );
      })}
    </div>,
    document.body,
  );
}
