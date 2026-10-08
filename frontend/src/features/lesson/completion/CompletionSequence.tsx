"use client";

import { AnimatePresence, motion } from "motion/react";
import { useLayoutEffect, useRef, type ReactNode } from "react";
import { useFadeSeconds } from "@/components/ui/transitions";
import type { ReviewItem } from "@/features/lesson/ReviewScorecard";
import type { CompletionOut } from "@/lib/api/types";
import { slideFor, type Celebration, type SlideCelebration } from "@/lib/lesson/celebrations";
import { AchievementModal } from "./AchievementModal";
import { HeartEarnedScreen } from "./HeartEarnedScreen";
import { LegendaryScreen } from "./LegendaryScreen";
import { LessonCompleteScreen } from "./LessonCompleteScreen";
import { QuestRewardScreen } from "./QuestRewardScreen";
import { StreakExtendedScreen } from "./StreakExtendedScreen";
import { TimedResultScreen } from "./TimedResultScreen";

/**
 * Presses this soon after a step appears are ignored. A key press can reach two steps: the player advances on
 * keydown, the next step's modal takes the focus at once, and the same key's keypress then clicks its button.
 */
const STEP_SETTLE_MS = 200;

export interface CompletionSequenceProps {
  completion: CompletionOut;
  /** From `buildCelebrations(completion)`. */
  steps: Celebration[];
  /** The step on screen. */
  index: number;
  /** CONTINUE on the current step. The player owns the index (and Enter), so it moves on from here. */
  onNext(): void;
  /** Called when REVIEW LESSON opens the scorecard. */
  onReview?(): void;
  /** The session's answers for the scorecard. REVIEW LESSON shows only with them (they are gone after a reload). */
  reviewItems?: ReviewItem[];
}

/**
 * The screens after a session, one step at a time: each screen fades in and plays its own choreography, and
 * an achievement opens as a modal over the screen before it. A full-viewport view with its own footer, shown
 * in place of the lesson layout.
 */
export function CompletionSequence({
  completion,
  steps,
  index,
  onNext,
  onReview,
  reviewItems,
}: CompletionSequenceProps) {
  const advance = useStepAdvance(steps, index, onNext);
  const fade = useFadeSeconds();
  const shown = slideFor(steps, index);
  const step = steps.at(index);

  return (
    <div className="relative min-h-dvh bg-page">
      <AnimatePresence mode="wait">
        {shown && (
          <motion.div
            key={shown.slideIndex}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: fade(0.25) } }}
            exit={{ opacity: 0, transition: { duration: fade(0.15) } }}
          >
            <Slide
              step={shown.slide}
              completion={completion}
              active={shown.slideIndex === index}
              onContinue={advance}
              onReview={onReview}
              reviewItems={reviewItems}
            />
          </motion.div>
        )}
      </AnimatePresence>
      {step?.kind === "achievement" && (
        <AchievementModal key={index} achievement={step.achievement} onContinue={advance} />
      )}
    </div>
  );
}

interface SlideProps {
  step: SlideCelebration;
  completion: CompletionOut;
  active: boolean;
  onContinue: () => void;
  onReview?: () => void;
  reviewItems?: ReviewItem[];
}

function Slide({ step, completion, active, onContinue, onReview, reviewItems }: SlideProps): ReactNode {
  const controls = { active, onContinue };
  switch (step.kind) {
    case "summary":
      return (
        <LessonCompleteScreen
          summary={step}
          perfect={completion.stats.perfect}
          onReview={onReview}
          reviewItems={reviewItems}
          {...controls}
        />
      );
    case "timedResult":
      return <TimedResultScreen completion={step.completion} {...controls} />;
    case "quests":
      return <QuestRewardScreen quests={step.quests} {...controls} />;
    case "streak":
      return <StreakExtendedScreen streak={step} {...controls} />;
    case "heartEarned":
      return <HeartEarnedScreen hearts={step.hearts} max={completion.me.hearts.max} {...controls} />;
    case "legendary":
      return <LegendaryScreen nodeTitle={step.nodeTitle} {...controls} />;
  }
}

/**
 * `onNext` at most once per step, and never in the first moments of a step: a double click, or a key press and
 * the click it also produces, cannot skip a screen. A new `steps` list starts afresh.
 */
function useStepAdvance(steps: Celebration[], index: number, onNext: () => void): () => void {
  const shownAt = useRef(0);
  const advancedFrom = useRef<{ steps: Celebration[]; index: number } | null>(null);

  useLayoutEffect(() => {
    shownAt.current = performance.now();
  }, [steps, index]);

  return () => {
    if (performance.now() - shownAt.current < STEP_SETTLE_MS) return;
    const last = advancedFrom.current;
    if (last && last.steps === steps && last.index === index) return;
    advancedFrom.current = { steps, index };
    onNext();
  };
}
