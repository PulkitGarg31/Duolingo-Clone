"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "motion/react";
import type { CSSProperties } from "react";
import { Owl } from "@/components/mascot/Owl";
import { Button } from "@/components/ui";
import styles from "./timedIntro.module.css";

/** Eight bubbles of different sizes, spread across the width and part-way through their 20 s climb. */
const BUBBLES = [
  { size: 120, x: "6%", alpha: 0.12, rest: "8dvh", duration: 21, delay: -2 },
  { size: 56, x: "22%", alpha: 0.15, rest: "62dvh", duration: 18, delay: -11 },
  { size: 160, x: "38%", alpha: 0.1, rest: "74dvh", duration: 24, delay: -17 },
  { size: 40, x: "52%", alpha: 0.15, rest: "18dvh", duration: 19, delay: -6 },
  { size: 88, x: "64%", alpha: 0.12, rest: "44dvh", duration: 22, delay: -14 },
  { size: 136, x: "78%", alpha: 0.1, rest: "4dvh", duration: 25, delay: -4 },
  { size: 64, x: "88%", alpha: 0.14, rest: "56dvh", duration: 20, delay: -9 },
  { size: 48, x: "12%", alpha: 0.13, rest: "86dvh", duration: 17, delay: -15 },
] as const;

/**
 * The screen is purple in both themes, so its own palette makes the START button white with purple text and a
 * pale purple lip, and the NOT NOW link white.
 */
const SURFACE = {
  "--surface": "var(--duo-betta)",
  "--c-bg": "#FFFFFF",
  "--c-fg-link": "#FFFFFF",
} as CSSProperties;

function Bubbles() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      {BUBBLES.map(({ size, x, alpha, rest, duration, delay }) => (
        <span
          key={x}
          className={styles.bubble}
          style={
            {
              "--size": `${size}px`,
              "--x": x,
              "--alpha": alpha,
              "--rest": rest,
              "--duration": `${duration}s`,
              "--delay": `${delay}s`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

interface TimedIntroProps {
  open: boolean;
  /** The session is being created; the 30 s clock starts the moment it exists. */
  starting: boolean;
  onStart: () => void;
  onClose: () => void;
}

/**
 * The full-screen purple intro to Timed practice. It is shown before the session exists, because the server
 * starts the clock when the session is created: the run begins only when the learner presses START.
 */
export function TimedIntro({ open, starting, onStart, onClose }: TimedIntroProps) {
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next && !starting) onClose();
      }}
    >
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Content forceMount asChild>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                style={SURFACE}
                className="fixed inset-0 z-(--z-modal) flex flex-col items-center overflow-hidden bg-(--duo-betta) px-6 pt-[max(48px,env(safe-area-inset-top))] pb-[calc(32px+env(safe-area-inset-bottom))] text-center text-on-color-fixed outline-none"
              >
                <Bubbles />
                <div className="relative flex flex-1 flex-col items-center justify-center">
                  <Owl pose="stopwatch" size={160} />
                  <Dialog.Title className="mt-8 text-[25px]/[31px] font-extrabold md:text-title-xl">
                    Timed practice
                  </Dialog.Title>
                  <Dialog.Description className="mt-3 max-w-[480px] text-body text-on-color-fixed/85 md:text-subtitle">
                    Answer as many as you can before time runs out!
                  </Dialog.Description>
                </div>
                <div className="relative grid w-full max-w-[330px] gap-2">
                  <Button variant="white" fullWidth loading={starting} onClick={onStart}>
                    Start
                  </Button>
                  <Button variant="ghost" fullWidth disabled={starting} onClick={onClose}>
                    Not now
                  </Button>
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
