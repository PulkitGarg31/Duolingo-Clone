import { motion } from "motion/react";

/**
 * The gloss stroke along the top-left of a completed (or Legendary) node, in the unit's shine colour. When
 * the node has just been completed it fades in after the new glyph has grown.
 */
export function NodeShine({ appear = false }: { appear?: boolean }) {
  return (
    <motion.svg
      aria-hidden="true"
      width={16}
      height={10}
      viewBox="0 0 16 10"
      className="pointer-events-none absolute top-[9px] left-[13px]"
      initial={appear ? { opacity: 0 } : false}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.6, duration: 0.3 }}
    >
      <path d="M2 8.2C3.4 5 6.6 2.4 11.4 1.8" fill="none" stroke="var(--node-shine)" strokeWidth={3} strokeLinecap="round" />
    </motion.svg>
  );
}
