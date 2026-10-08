"use client";

import { useEffect, useRef } from "react";
import { useToast } from "@/components/ui";
import type { LeagueRowOut, LeagueZone } from "@/lib/api/types";
import { myRow, zoneChangeMessage } from "./standings";

/**
 * Announces the learner crossing into the promotion or demotion zone between two versions of the board: the
 * cached one shown on return from a lesson and the fresh one that replaces it, or two minute-by-minute refreshes.
 */
export function useZoneChangeToast(rows: readonly LeagueRowOut[] | undefined): void {
  const { toast } = useToast();
  const zone = rows ? myRow(rows)?.zone : undefined;
  const previous = useRef<LeagueZone | undefined>(undefined);

  useEffect(() => {
    if (zone === undefined) return;
    const message = zoneChangeMessage(previous.current, zone);
    previous.current = zone;
    if (message) toast({ tone: zone === "promotion" ? "success" : "warning", message });
  }, [zone, toast]);
}
