"use client";

import { motion } from "motion/react";
import { Owl } from "@/components/mascot/Owl";
import { SpeechBubble } from "@/components/mascot/SpeechBubble";
import type { CoachMessage } from "@/lib/lesson/lessonMachine";
import { coachLine } from "./coachCopy";

const SPRING = [0.34, 1.56, 0.64, 1] as const;

/**
 * The owl's interstitial between exercises (5 or 10 in a row, 3 misses, the last heart). It replaces the
 * next exercise until CONTINUE: the owl slides in, then its speech bubble pops.
 */
export function CoachSlide({ message }: { message: CoachMessage }) {
  const { text, pose } = coachLine(message);
  return (
    <div role="status" className="flex items-center justify-center gap-2 py-6 md:gap-4">
      <motion.div initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }}>
        <Owl pose={pose} size={160} className="h-[132px] w-auto md:h-[160px]" />
      </motion.div>
      <motion.div
        className="max-w-[60%] self-start pt-6 md:max-w-[320px]"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.15, duration: 0.2, ease: SPRING }}
      >
        <SpeechBubble tail="left" size="lg">
          <p className="text-[17px]/[25px] font-semibold text-fg md:text-subtitle">{text}</p>
        </SpeechBubble>
      </motion.div>
    </div>
  );
}
