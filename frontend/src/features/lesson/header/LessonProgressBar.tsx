"use client";

import { AnimatePresence } from "motion/react";
import { ProgressBar, type ProgressTone } from "@/components/ui/ProgressBar";
import { cn } from "@/lib/cn";
import { ComboLabel } from "./ComboLabel";

/** A milestone circle on the bar: Legendary's 40 XP at the end, Timed practice's 5 / 10 / 20 correct. */
export interface Checkpoint {
  /** Position from 0 (start) to 1 (end). */
  at: number;
  label: string;
  reached: boolean;
}

const CHECKPOINT_STYLES: Partial<Record<ProgressTone, { idle: string; reached: string }>> = {
  gold: { idle: "border-gold bg-page text-(--unit-gold-dark)", reached: "border-gold bg-gold text-(--unit-gold-dark)" },
  beetle: { idle: "border-beetle bg-page text-beetle", reached: "border-beetle bg-beetle text-on-color-fixed" },
};

interface LessonProgressBarProps {
  /** 0 to 1. */
  value: number;
  tone: ProgressTone;
  combo: number;
  showCombo: boolean;
  checkpoints: readonly Checkpoint[];
}

/**
 * The 16 px lesson bar with its gloss stripe. "N IN A ROW" floats above it from 2 correct answers in a row;
 * a white shine sweeps the fill when the streak turns it gold (6) and orange (11).
 */
export function LessonProgressBar({ value, tone, combo, showCombo, checkpoints }: LessonProgressBarProps) {
  const styles = CHECKPOINT_STYLES[tone];
  return (
    <div className="relative min-w-0 flex-1">
      <AnimatePresence>{showCombo && combo >= 2 && <ComboLabel key="combo" combo={combo} tone={tone} />}</AnimatePresence>
      <ProgressBar value={value} tone={tone} height={16} aria-label="Lesson progress" />
      {(combo === 6 || combo === 11) && <Shine key={combo} value={value} />}
      {styles &&
        checkpoints.map((checkpoint) => (
          <span
            key={checkpoint.label}
            style={{ left: `${checkpoint.at * 100}%` }}
            className={cn(
              "absolute top-1/2 grid size-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 text-[12px] leading-none font-black",
              checkpoint.reached ? cn(styles.reached, "animate-pop-in") : styles.idle,
            )}
          >
            {checkpoint.label}
          </span>
        ))}
    </div>
  );
}

/** One white sweep across the filled part of the bar. */
function Shine({ value }: { value: number }) {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-y-0 left-0 overflow-hidden rounded-full"
      style={{ width: `max(24px, ${value * 100}%)` }}
    >
      <span className="absolute inset-0 animate-[shine-sweep_600ms_ease-out_forwards] bg-[linear-gradient(90deg,transparent,rgb(255_255_255/.4),transparent)]" />
    </span>
  );
}
