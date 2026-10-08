import { motion } from "motion/react";
import { CrownIcon } from "@/components/icons";

interface CrownBadgeProps {
  /** The node's crown level: 1 once completed, 2 when Legendary. */
  level: number;
  legendary: boolean;
  /** Flies in from twice its size, as when the node has just been completed. */
  flyIn?: boolean;
}

/**
 * The crown on a completed node's lower right, numbered with its level. A Legendary crown carries a white
 * sparkle instead of a number.
 */
export function CrownBadge({ level, legendary, flyIn = false }: CrownBadgeProps) {
  return (
    <motion.span
      aria-hidden="true"
      className="pointer-events-none absolute -right-1.5 bottom-1 z-[2]"
      initial={flyIn ? { scale: 2, y: -20, opacity: 0 } : false}
      animate={{ scale: 1, y: 0, opacity: 1 }}
      transition={{ delay: 0.6, duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
    >
      <CrownIcon size={26} level={legendary ? undefined : level} />
      {legendary && (
        <svg aria-hidden="true" width={10} height={10} viewBox="0 0 10 10" className="absolute top-[11px] left-[8px]">
          <path d="M5 0.8 6 4 9.2 5 6 6 5 9.2 4 6 0.8 5 4 4Z" fill="#FFFFFF" stroke="#FFFFFF" strokeWidth={0.8} strokeLinejoin="round" />
        </svg>
      )}
    </motion.span>
  );
}
