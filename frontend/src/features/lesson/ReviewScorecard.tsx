"use client";

import { CheckIcon, CrossIcon } from "@/components/icons";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { cn } from "@/lib/cn";
import { COMPLETION_COPY } from "@/lib/lesson/copy";

/** One answered exercise, as the learner saw it: kept in memory by the lesson player, never fetched. */
export interface ReviewItem {
  /** The sentence or instruction the exercise showed. */
  prompt: string;
  /** What the learner answered, as display text ("Skipped" for a skip). */
  given: string;
  /** The server's solution; null where there is none to show (match pairs). */
  correctAnswer: string | null;
  correct: boolean;
}

interface ReviewScorecardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: readonly ReviewItem[];
}

/** REVIEW LESSON: every answer of the session with its verdict, and the solution where the answer was wrong. */
export function ReviewScorecard({ open, onOpenChange, items }: ReviewScorecardProps) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={COMPLETION_COPY.scorecardTitle}
      actions={<Button onClick={() => onOpenChange(false)}>{COMPLETION_COPY.gotIt}</Button>}
    >
      <ol className="-mx-1 max-h-[min(52dvh,420px)] overflow-y-auto px-1">
        {items.map((item, index) => (
          // Answers never reorder and a retried exercise repeats its prompt, so the position is the identity.
          <ReviewRow key={index} item={item} />
        ))}
      </ol>
    </Modal>
  );
}

function ReviewRow({ item }: { item: ReviewItem }) {
  const showSolution = !item.correct && item.correctAnswer !== null;
  return (
    <li className="flex gap-3 border-t-2 border-line py-3 text-left first:border-t-0 first:pt-0">
      <VerdictBadge correct={item.correct} />
      <div className="min-w-0 text-body break-words">
        <p className="font-extrabold text-fg-strong">{item.prompt}</p>
        <p className={item.correct ? "text-fg-2" : "text-wrong-fg line-through decoration-2"}>
          <span className="sr-only">{COMPLETION_COPY.yourAnswer} </span>
          {item.given}
        </p>
        {showSolution && (
          <p className="text-correct-fg">
            <span className="sr-only">{COMPLETION_COPY.correctAnswer} </span>
            {item.correctAnswer}
          </p>
        )}
      </div>
    </li>
  );
}

/** A ✓ or ✗ in a tinted circle; the text alternative says it too, so colour is never the only signal. */
function VerdictBadge({ correct }: { correct: boolean }) {
  return (
    <span
      className={cn(
        "mt-0.5 grid size-7 shrink-0 place-items-center rounded-full",
        correct ? "bg-correct text-correct-fg" : "bg-wrong text-wrong-fg",
      )}
    >
      {correct ? <CheckIcon size={14} /> : <CrossIcon size={11} />}
      <span className="sr-only">{correct ? COMPLETION_COPY.correct : COMPLETION_COPY.incorrect}</span>
    </span>
  );
}
