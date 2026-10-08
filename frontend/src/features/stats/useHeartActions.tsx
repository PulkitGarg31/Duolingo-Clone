"use client";

import { HeartIcon } from "@/components/icons";
import { useToast } from "@/components/ui";
import { domainErrorMessage } from "@/features/shell/domainErrorMessage";
import { newIdempotencyKey } from "@/lib/idempotency";
import { usePurchase, useStartSession } from "@/lib/queries/mutations";

export interface HeartActions {
  /** Buys a full refill with gems; `onRefilled` runs once the hearts are back. */
  refill: (onRefilled?: () => void) => void;
  /** Starts a practice session, which earns a heart and opens the lesson player. */
  practice: () => void;
  refilling: boolean;
  practicing: boolean;
}

/** The two ways to get hearts back now, shared by the hearts popover and the "need hearts" modal. */
export function useHeartActions(): HeartActions {
  const purchase = usePurchase();
  const start = useStartSession();
  const { toast } = useToast();

  function refill(onRefilled?: () => void) {
    // One key per click, so automatic retries of this click can never charge twice.
    purchase.mutate(
      { itemCode: "heart_refill", idempotencyKey: newIdempotencyKey() },
      {
        onSuccess: () => {
          toast({ tone: "reward", icon: <HeartIcon size={28} />, message: "Hearts refilled!" });
          onRefilled?.();
        },
        onError: (error) => {
          const message = domainErrorMessage(error, {
            INSUFFICIENT_GEMS: "Not enough gems",
            HEARTS_ALREADY_FULL: "You have full hearts",
          });
          if (message) toast({ tone: "warning", message });
        },
      },
    );
  }

  function practice() {
    start.mutate(
      { kind: "practice" },
      {
        onError: (error) => {
          const message = domainErrorMessage(error, { NOTHING_TO_PRACTICE: "Complete a lesson to unlock practice" });
          if (message) toast({ tone: "warning", message });
        },
      },
    );
  }

  return { refill, practice, refilling: purchase.isPending, practicing: start.isPending };
}
