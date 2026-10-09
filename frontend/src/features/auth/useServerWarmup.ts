import { useEffect } from "react";
import { useWakeGate, wakeGate, type WakeState } from "@/lib/api/serverStatus";
import { probeHealth } from "@/features/shell/healthProbe";

/**
 * Starts waking the server as soon as a form opens, without covering the page: the free instance may be asleep,
 * and the visitor's typing hides most of the wait. A submit made before the server answers is held (the query
 * client treats a waking server as offline) and goes out once /health answers. Returns the gate's state for
 * the notice under the submit button.
 */
export function useServerWarmup(): WakeState {
  useEffect(() => {
    wakeGate.start(probeHealth);
  }, []);
  return useWakeGate();
}
