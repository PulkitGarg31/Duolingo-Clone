"use client";

import { CheckIcon } from "@/components/icons/CheckIcon";
import { CrossIcon } from "@/components/icons/CrossIcon";
import { ReportFlagIcon } from "@/components/icons/ReportFlagIcon";
import { Button, type ButtonVariant } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import type { FeedbackCopy, FeedbackTone } from "./feedbackCopy";
import { FOOTER_GRID } from "./FooterFrame";
import type { Highlighted } from "./highlight";

interface ToneStyle {
  /** The bar's colour, its top rule on wide screens, and the ink of its words. */
  surface: string;
  ink: string;
  continueVariant: ButtonVariant;
}

const TONES: Record<FeedbackTone, ToneStyle> = {
  correct: { surface: "bg-correct md:border-correct-line", ink: "text-correct-fg", continueVariant: "primary" },
  incorrect: { surface: "bg-wrong md:border-wrong", ink: "text-wrong-fg", continueVariant: "danger" },
  skipped: { surface: "bg-skip md:border-skip", ink: "text-skip-fg", continueVariant: "primary" },
};

interface FeedbackBarProps {
  copy: FeedbackCopy;
  onContinue(): void;
  onReport(): void;
}

/**
 * The verdict, replacing the footer after CHECK: green, red or (for SKIP) yellow. On wide screens the colour
 * switches in place and the badge pops; on phones the bar slides up as a sheet. CONTINUE takes the focus,
 * so Enter moves on.
 */
export function FeedbackBar({ copy, onContinue, onReport }: FeedbackBarProps) {
  const tone = TONES[copy.tone];
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "relative animate-sheet-up md:animate-none md:border-t-2",
        // Overscrolling a phone never shows white under the sheet.
        "after:absolute after:inset-x-0 after:top-full after:h-dvh after:bg-inherit",
        tone.surface,
      )}
    >
      <div className={cn(FOOTER_GRID, "pt-6 md:pt-0")}>
        <div className="flex items-center md:col-span-4">
          <VerdictBadge tone={copy.tone} />
          <div className={cn("min-w-0 flex-1 md:animate-[feedback-in_200ms_cubic-bezier(0,0,.2,1)]", tone.ink)}>
            <div className="flex items-center justify-between gap-3 md:justify-start">
              <h2 className="text-[22px]/[30px] font-extrabold md:text-title">{copy.title}</h2>
              <button
                type="button"
                aria-label="Report"
                onClick={onReport}
                className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-sm opacity-70 hover:opacity-100 focus-visible:outline-2 focus-visible:outline-focus"
              >
                <ReportFlagIcon size={24} />
              </button>
            </div>
            {copy.lead && <p className="text-body font-extrabold">{copy.lead}</p>}
            {copy.solution && (
              <p className="text-body md:text-subtitle">
                <Solution runs={copy.solution} />
              </p>
            )}
            {copy.tail.map((line) => (
              <p key={line} className="text-body md:text-subtitle">
                {line}
              </p>
            ))}
          </div>
        </div>
        <Button
          variant={tone.continueVariant}
          size="lg"
          autoFocus
          onClick={onContinue}
          className="mt-1 md:col-start-5 md:mt-0 md:justify-self-end"
        >
          Continue
        </Button>
      </div>
    </div>
  );
}

/** The 80 px white circle with the check or the cross (wide screens only). */
function VerdictBadge({ tone }: { tone: FeedbackTone }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "mr-4 hidden size-20 shrink-0 place-items-center rounded-full bg-badge md:grid",
        "animate-[badge-pop_300ms_cubic-bezier(.34,1.56,.64,1)]",
        TONES[tone].ink,
      )}
    >
      {tone === "correct" ? <CheckIcon size={41} /> : <CrossIcon size={31} />}
    </span>
  );
}

/** The solution text; the parts the learner got wrong are bold and underlined. */
function Solution({ runs }: { runs: Highlighted[] }) {
  return (
    <>
      {runs.map((run, index) =>
        run.changed ? (
          <strong key={index} className="font-extrabold underline decoration-2 underline-offset-4">
            {run.text}
          </strong>
        ) : (
          <span key={index}>{run.text}</span>
        ),
      )}
    </>
  );
}
