import { motion } from "motion/react";
import { ProgressRing } from "@/components/ui";

interface NodeRingProps {
  /** Lessons completed in the skill, from 0 to 1. */
  progress: number;
  /** The node was just completed: the ring finishes filling, then fades away. */
  fadeOut?: boolean;
}

/**
 * The active node's progress ring: 98 px, a grey track and an arc in the unit colour, squashed slightly so it
 * hugs the oval face. It sits under the face and never takes clicks.
 */
export function NodeRing({ progress, fadeOut = false }: NodeRingProps) {
  return (
    <motion.span
      aria-hidden="true"
      className="pointer-events-none absolute top-[28.5px] left-[35px] z-0"
      animate={fadeOut ? { opacity: 0 } : { opacity: 1 }}
      transition={{ delay: fadeOut ? 0.3 : 0, duration: 0.3 }}
    >
      <ProgressRing value={progress} size={98} stroke={8} color="var(--unit)" className="[transform:translate(-50%,-50%)_scaleY(.946)]" />
    </motion.span>
  );
}
