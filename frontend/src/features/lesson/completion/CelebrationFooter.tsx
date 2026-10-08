"use client";

import { useIsPresent } from "motion/react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { COMPLETION_COPY } from "@/lib/lesson/copy";

export interface FooterAction {
  label: string;
  onClick: () => void;
}

interface CelebrationFooterProps {
  /** Whether this screen is the current step. A screen fading out or covered by a modal ignores presses. */
  active: boolean;
  onContinue: () => void;
  /** Green on white screens, gold on the legendary screen, white on the purple one. */
  variant?: "primary" | "gold" | "white";
  /** REVIEW LESSON: an outline button on the left from 700 px, a text button under CONTINUE on phones. */
  secondary?: FooterAction;
}

/**
 * The buttons of a celebration screen, laid out like the lesson footer: from 700 px a 140 px bar on a
 * five-column grid with CONTINUE in the last column; on phones a full-width CONTINUE. CONTINUE takes the
 * focus, so Space or Enter works from the keyboard straight away.
 */
export function CelebrationFooter({ active, onContinue, variant = "primary", secondary }: CelebrationFooterProps) {
  // The key press that advanced the sequence can still deliver its click to the outgoing screen's button.
  const isPresent = useIsPresent();
  const live = active && isPresent;
  const act = (action: () => void) => () => {
    if (live) action();
  };

  return (
    <div
      className={cn(
        "mx-auto flex max-w-[1000px] flex-col gap-2 px-4 pt-4 pb-[calc(16px+env(safe-area-inset-bottom))]",
        "md:grid md:min-h-[140px] md:grid-cols-5 md:items-center md:gap-x-4 md:px-10 md:py-0",
      )}
    >
      <div className="md:col-start-5 md:row-start-1 md:justify-self-end">
        {/* Each screen replaces the last one, so the focus moves on with it. */}
        <Button variant={variant} size="lg" autoFocus onClick={act(onContinue)}>
          {COMPLETION_COPY.continue}
        </Button>
      </div>
      {secondary && (
        <>
          <div className="hidden md:col-start-1 md:row-start-1 md:block">
            <Button variant="outline-muted" size="lg" onClick={act(secondary.onClick)}>
              {secondary.label}
            </Button>
          </div>
          <div className="md:hidden">
            <Button variant="ghost" size="lg" fullWidth onClick={act(secondary.onClick)}>
              {secondary.label}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
