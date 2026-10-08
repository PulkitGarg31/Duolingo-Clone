"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { GemIcon } from "@/components/icons";
import { useToast } from "@/components/ui";
import { domainErrorMessage } from "@/features/shell/domainErrorMessage";
import type { ApiError } from "@/lib/api/errors";
import type { PathNodeOut, SessionKind } from "@/lib/api/types";
import { qk } from "@/lib/queries/keys";
import { useClaimChest, useStartSession } from "@/lib/queries/mutations";
import type { NodeActionKind, PendingNodeAction } from "./nodePopoverModel";

/** A modal that remembers its subject while it animates closed. */
interface ModalState<T> {
  open: boolean;
  subject: T;
}

/** Friendly copy for the start errors a click can run into; others show the server's explanation. */
const START_ERRORS = {
  INSUFFICIENT_GEMS: "Not enough gems",
  NODE_LOCKED: "Complete all levels above to unlock this!",
  NOTHING_TO_PRACTICE: "Complete a lesson to unlock practice",
} as const;

export interface PathActions {
  openNodeId: number | null;
  setOpenNodeId: (nodeId: number | null) => void;
  pending: PendingNodeAction | null;
  onAction: (node: PathNodeOut, kind: NodeActionKind) => void;
  onClaimChest: (node: PathNodeOut) => void;
  legendary: ModalState<PathNodeOut | null>;
  setLegendaryOpen: (open: boolean) => void;
  startLegendary: () => void;
  legendaryStarting: boolean;
  needHeartsOpen: boolean;
  setNeedHeartsOpen: (open: boolean) => void;
}

/**
 * Everything a click on the path can do. Sessions start only from a click (never on page load): START,
 * PRACTICE and, after its intro, LEGENDARY. A START with no hearts opens the start gate instead (the server
 * would refuse it anyway). Opening a chest claims it straight away.
 */
export function usePathActions(hearts: number): PathActions {
  const start = useStartSession();
  const claim = useClaimChest();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [openNodeId, setOpenNodeId] = useState<number | null>(null);
  const [legendary, setLegendary] = useState<ModalState<PathNodeOut | null>>({ open: false, subject: null });
  const [needHeartsOpen, setNeedHeartsOpen] = useState(false);

  function startSession(node: PathNodeOut, kind: SessionKind) {
    start.mutate({ kind, nodeId: node.id }, { onError: handleStartError });
  }

  function handleStartError(error: ApiError) {
    setOpenNodeId(null);
    setLegendary((current) => ({ ...current, open: false }));
    if (error.code === "OUT_OF_HEARTS") {
      // Our hearts count was out of date: refresh it, then offer the ways to get hearts back.
      void queryClient.invalidateQueries({ queryKey: qk.me, exact: true });
      setNeedHeartsOpen(true);
      return;
    }
    if (error.status === 409 && error.code !== "INSUFFICIENT_GEMS") {
      // The path changed on the server (locked, already completed...): show it as it is now.
      void queryClient.invalidateQueries({ queryKey: qk.path });
    }
    const message = domainErrorMessage(error, START_ERRORS);
    if (message) toast({ tone: "warning", message });
  }

  function onAction(node: PathNodeOut, kind: NodeActionKind) {
    if (kind === "legendary") {
      setOpenNodeId(null);
      setLegendary({ open: true, subject: node });
    } else if (kind === "lesson" && hearts === 0) {
      setOpenNodeId(null);
      setNeedHeartsOpen(true);
    } else {
      startSession(node, kind);
    }
  }

  function startLegendary() {
    if (legendary.subject) startSession(legendary.subject, "legendary");
  }

  function onClaimChest(node: PathNodeOut) {
    claim.mutate(node.id, {
      onSuccess: ({ gemsAwarded }) =>
        toast({
          tone: "reward",
          icon: <GemIcon size={28} />,
          message: <span className="font-extrabold text-gem">+{gemsAwarded} gems</span>,
        }),
      onError: (error) => {
        const message = domainErrorMessage(error);
        if (message) toast({ tone: "warning", message });
      },
    });
  }

  const startingKind = start.isPending ? start.variables?.kind : undefined;
  const pendingNodeId = start.variables?.nodeId;
  const pending: PendingNodeAction | null =
    (startingKind === "lesson" || startingKind === "practice") && typeof pendingNodeId === "number"
      ? { nodeId: pendingNodeId, kind: startingKind }
      : null;

  return {
    openNodeId,
    setOpenNodeId,
    pending,
    onAction,
    onClaimChest,
    legendary,
    setLegendaryOpen: (open) => setLegendary((current) => ({ ...current, open })),
    startLegendary,
    legendaryStarting: startingKind === "legendary",
    needHeartsOpen,
    setNeedHeartsOpen,
  };
}
