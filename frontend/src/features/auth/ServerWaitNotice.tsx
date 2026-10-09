"use client";

import { Button } from "@/components/ui";
import { wakeGate, type WakeState } from "@/lib/api/serverStatus";

interface ServerWaitNoticeProps {
  /** The submit is held until the server answers. */
  waiting: boolean;
  gate: WakeState;
}

/**
 * Explains a submit button that keeps loading because the server is still waking up, or offers TRY AGAIN once
 * the wake gate has given up. The held request goes out by itself when the server answers.
 */
export function ServerWaitNotice({ waiting, gate }: ServerWaitNoticeProps) {
  if (!waiting) return null;
  if (gate.phase === "failed") {
    return (
      <div role="alert" className="mt-3 flex flex-col items-center gap-1 text-center">
        <p className="text-small text-wrong-fg">We couldn&apos;t reach the server. Check your connection.</p>
        <Button variant="ghost" size="inline" onClick={wakeGate.retry}>
          Try again
        </Button>
      </div>
    );
  }
  return (
    <p role="status" className="mt-3 text-center text-small text-fg-2">
      {gate.slow
        ? "Almost there. Thanks for your patience!"
        : "The owl is waking up the server. This can take up to a minute."}
    </p>
  );
}
