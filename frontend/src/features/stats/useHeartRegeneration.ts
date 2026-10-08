import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import type { ISODateTime } from "@/lib/api/types";
import { qk } from "@/lib/queries/keys";
import { remainingMs, serverNow } from "@/lib/time/serverClock";

/** A little after the heart is due, so the server's clock has certainly passed it. */
const GRACE_MS = 1_000;

/**
 * Refetches `me` when the next heart is due, so the regenerated heart shows up without a reload. Hearts are
 * counted by the server; the client only knows when to ask again. Mount it once, in the app frame.
 */
export function useHeartRegeneration(nextHeartAt: ISODateTime | null | undefined): void {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!nextHeartAt) return;
    const timer = setTimeout(
      () => void queryClient.invalidateQueries({ queryKey: qk.me, exact: true }),
      remainingMs(nextHeartAt, serverNow()) + GRACE_MS,
    );
    return () => clearTimeout(timer);
  }, [nextHeartAt, queryClient]);
}
