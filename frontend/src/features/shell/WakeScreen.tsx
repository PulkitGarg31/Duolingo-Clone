"use client";

import { motion } from "motion/react";
import { useTheme } from "@/lib/theme/ThemeProvider";

const COPY = {
  wakingTitle: "The owl is waking up!",
  wakingBody: "Our free server naps when nobody's around. This can take up to a minute.",
  slow: "Almost there. Thanks for your patience!",
  failedTitle: "We couldn't reach the server",
  failedBody: "Check your connection and try again.",
  retry: "Try again",
};

interface WakeScreenProps {
  /** We gave up (90 s passed, or the browser is offline): offer TRY AGAIN. */
  failed: boolean;
  /** The wait has passed 20 s. */
  slow: boolean;
  onRetry: () => void;
}

/** Covers the page while the API wakes up, or when it cannot be reached. */
export function WakeScreen({ failed, slow, onRetry }: WakeScreenProps) {
  return (
    <motion.div
      className="fixed inset-0 z-[calc(var(--z-modal)_+_1)] flex items-center justify-center bg-page px-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div role={failed ? "alert" : "status"} className="flex w-full max-w-[420px] flex-col items-center gap-4 text-center">
        {failed ? <Unreachable onRetry={onRetry} /> : <Waking slow={slow} />}
      </div>
    </motion.div>
  );
}

function Waking({ slow }: { slow: boolean }) {
  const { reducedMotion } = useTheme();
  return (
    <>
      <SleepingZs still={reducedMotion} />
      <h2 className="text-title text-fg-strong">{COPY.wakingTitle}</h2>
      <p className="text-subtitle text-fg-2">{COPY.wakingBody}</p>
      <IndeterminateBar still={reducedMotion} />
      {slow && <p className="text-body text-fg-2">{COPY.slow}</p>}
    </>
  );
}

function Unreachable({ onRetry }: { onRetry: () => void }) {
  return (
    <>
      <h2 className="text-title text-fg-strong">{COPY.failedTitle}</h2>
      <p className="text-subtitle text-fg-2">{COPY.failedBody}</p>
      <button
        type="button"
        onClick={onRetry}
        className="pressable mt-2 h-[50px] w-full max-w-[330px] rounded-md bg-primary px-6 text-label uppercase text-on-color shadow-[0_4px_0_var(--c-primary-lip)] [--lip:4px] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus"
      >
        {COPY.retry}
      </button>
    </>
  );
}

/** Three "z"s drifting up from a sleeper, staggered. */
function SleepingZs({ still }: { still: boolean }) {
  return (
    <div aria-hidden="true" className="flex h-16 items-end gap-1 font-extrabold leading-none text-fg-3">
      {[17, 24, 32].map((size, index) => (
        <motion.span
          key={size}
          style={{ fontSize: size }}
          animate={still ? undefined : { y: [0, -24], opacity: [0, 1, 0] }}
          transition={{ duration: 2.4, delay: index * 0.6, repeat: Infinity, ease: "easeOut" }}
        >
          z
        </motion.span>
      ))}
    </div>
  );
}

/** A 30 % fill sliding along a track: progress with no known end. */
function IndeterminateBar({ still }: { still: boolean }) {
  return (
    <div
      role="progressbar"
      aria-label="Waking up the server"
      className="relative h-4 w-[280px] max-w-full overflow-hidden rounded-full bg-track"
    >
      <motion.div
        className="absolute inset-y-0 left-0 w-[30%] rounded-full bg-fill"
        initial={{ x: still ? "117%" : "-100%" }}
        animate={still ? undefined : { x: ["-100%", "334%"] }}
        transition={{ duration: 1.4, ease: "easeInOut", repeat: Infinity }}
      >
        <span className="absolute inset-x-1 top-1 h-[30%] rounded-full bg-[var(--c-gloss)]" />
      </motion.div>
    </div>
  );
}
