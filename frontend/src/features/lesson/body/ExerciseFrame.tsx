"use client";

import { LayoutGroup, motion } from "motion/react";
import type { SessionItemOut } from "@/lib/api/types";
import { ExerciseView } from "../exercises/ExerciseView";
import type { ExerciseViewProps } from "../exercises/types";
import { ExerciseLabel } from "./ExerciseLabel";

type FrameProps = Omit<ExerciseViewProps<SessionItemOut["exercise"]>, "exercise"> & {
  item: SessionItemOut;
  allowKeyboard: boolean;
  onCantListen(): void;
};

/**
 * One exercise on screen: its label (NEW WORD, PREVIOUS MISTAKE), the instruction and the exercise view.
 * Render it keyed by item id: each new item slides in from the right with fresh view state, and its token
 * flights stay within it.
 */
export function ExerciseFrame({ item, ...viewProps }: FrameProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, ease: [0, 0, 0.2, 1] }}
      className="grid gap-4 md:gap-6"
    >
      <div>
        {item.label && <ExerciseLabel label={item.label} />}
        <h1 className="text-[25px] leading-[31px] font-extrabold text-fg md:text-title-xl">{item.exercise.instruction}</h1>
      </div>
      <LayoutGroup id={`item-${item.id}`}>
        <ExerciseView {...viewProps} exercise={item.exercise} />
      </LayoutGroup>
    </motion.div>
  );
}
