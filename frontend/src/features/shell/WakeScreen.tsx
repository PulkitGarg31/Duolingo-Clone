"use client";

import { motion } from "motion/react";
import { Owl } from "@/components/mascot";
import { Button } from "@/components/ui";
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
      {/* The sleeping pose draws its own floating z's. */}
      <Owl pose="sleep" size={180} />
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
      <Owl pose="sad" size={160} />
      <h2 className="text-title text-fg-strong">{COPY.failedTitle}</h2>
      <p className="text-subtitle text-fg-2">{COPY.failedBody}</p>
      <Button fullWidth className="mt-2 max-w-[330px]" onClick={onRetry}>
        {COPY.retry}
      </Button>
    </>
  );
}

/** A 30 % fill sliding along a track: progress with no known end. */
function IndeterminateBar({ still }: { still: boolean }) {
  return (
    <div
      role="progressbar"
      aria-label="Waking up the server"
      className="relative mt-2 h-4 w-[280px] max-w-full overflow-hidden rounded-full bg-track"
    >
      <motion.div
        className="absolute inset-y-0 left-0 w-[30%] rounded-full bg-fill"
        initial={{ x: still ? "117%" : "-100%" }}
        animate={still ? undefined : { x: ["-100%", "334%"] }}
        transition={{ duration: 1.4, ease: "easeInOut", repeat: Infinity }}
      >
        <span className="absolute inset-x-1 top-1 h-[30%] rounded-full bg-(--c-gloss)" />
      </motion.div>
    </div>
  );
}
