"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { ANSWER_CHOICE } from "../keyboard/LessonKeyboard";

/** Token flights between the bank and the answer: 200 ms, decelerating. */
const FLIGHT = { duration: 0.2, ease: [0, 0, 0.2, 1] } as const;

/** Shared by the token and its ghost slot, so the slot is exactly the token's size. */
const TOKEN_BOX =
  "h-11 rounded-md border-2 px-3 text-[17px] leading-[1.15] font-semibold whitespace-nowrap md:h-[50px] md:px-4 md:text-[19px]";

interface WordTokenProps {
  /** Shared by the bank copy and the answer copy, so the token flies from one place to the other. */
  layoutId: string;
  children: ReactNode;
  onClick(): void;
  disabled?: boolean;
  /** Fills its slot (a bank position) instead of sizing itself. */
  fill?: boolean;
  /** Sits above its neighbours while it flies. */
  raised?: boolean;
  /** The 1–9 key that picks it, announced to assistive technology. */
  shortcut?: string;
  className?: string;
}

/**
 * A word tile: white with a 2 px border and a 2 px lip, pressing down 2 px. Moving between parents with the
 * same `layoutId` animates it from its old place to its new one.
 */
export function WordToken({ layoutId, children, onClick, disabled = false, fill = false, raised = false, shortcut, className }: WordTokenProps) {
  return (
    <motion.button
      {...ANSWER_CHOICE}
      type="button"
      layoutId={layoutId}
      layout="position"
      transition={FLIGHT}
      onClick={onClick}
      disabled={disabled}
      aria-keyshortcuts={shortcut}
      className={cn(
        TOKEN_BOX,
        "inline-flex cursor-pointer items-center justify-center border-line bg-page text-fg shadow-[0_2px_0_var(--c-line)]",
        // The press uses `translate`, not `transform`, which Motion owns for the flight.
        "transition-[translate,box-shadow] duration-100 ease-linear enabled:active:translate-y-0.5 enabled:active:shadow-none",
        "select-none [-webkit-tap-highlight-color:transparent] enabled:hover:bg-subtle disabled:cursor-default",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
        fill ? "absolute inset-0" : "relative",
        raised ? "z-[2]" : "z-[1]",
        className,
      )}
    >
      {children}
    </motion.button>
  );
}

/** The grey place a used token leaves in the bank; it keeps the token's text, invisibly, for its size. */
export function GhostSlot({ children }: { children: ReactNode }) {
  return (
    <span aria-hidden="true" className={cn(TOKEN_BOX, "flex items-center border-transparent bg-line text-transparent")}>
      {children}
    </span>
  );
}
