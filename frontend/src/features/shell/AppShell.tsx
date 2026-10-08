"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useHeartRegeneration } from "@/features/stats/useHeartRegeneration";
import { useMe, useQuests } from "@/lib/queries/hooks";
import { AppShellView } from "./AppShellView";
import { useTimezoneAdoption } from "./useTimezoneAdoption";

/**
 * The app frame's data: the learner (`me`) for the menus and stats, today's quests for the rail, the device
 * time zone adoption on a first visit, and a refetch when the next heart is due.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const me = useMe().data;
  const quests = useQuests().data;
  useTimezoneAdoption(me?.user);
  useHeartRegeneration(me?.hearts.nextHeartAt);
  return (
    <AppShellView pathname={pathname} me={me} quests={quests}>
      {children}
    </AppShellView>
  );
}
