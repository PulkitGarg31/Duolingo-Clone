"use client";

import { AnimatePresence, motion } from "motion/react";
import { ArrowIcon } from "@/components/icons";
import { Button } from "@/components/ui";

interface GoToCurrentButtonProps {
  /** Where the current node is: above or below the window. Null hides the button. */
  direction: "up" | "down" | null;
  onClick: () => void;
}

/**
 * A round button at the bottom right of the path that scrolls back to the current node, shown only while that
 * node is out of view. It sits in a zero-height sticky strip at the end of the path, which keeps it on screen
 * at the column's right edge (above the tab bar on phones).
 */
export function GoToCurrentButton({ direction, onClick }: GoToCurrentButtonProps) {
  return (
    <div className="pointer-events-none sticky bottom-[calc(98px+env(safe-area-inset-bottom))] z-(--z-sticky) h-0 lg:bottom-6">
      <AnimatePresence>
        {direction && (
          <motion.div
            className="pointer-events-auto absolute right-4 bottom-0 md:right-0"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.15 }}
          >
            <Button variant="outline" size="round" aria-label="Go to current unit" onClick={onClick}>
              <ArrowIcon direction={direction} size={24} />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
