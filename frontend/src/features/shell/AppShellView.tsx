"use client";

import { useState, type ReactNode } from "react";
import { StatsBar } from "@/features/stats/StatsBar";
import { StatsBarSkeleton } from "@/features/stats/StatsBarSkeleton";
import type { MeOut, QuestsOut } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { BottomNav } from "./BottomNav";
import { showsDevTimeBadge } from "./clockOffset";
import { ComingSoonProvider } from "./ComingSoon";
import { ContentFadeIn } from "./ContentFadeIn";
import { DevTimeBadge } from "./DevTimeBadge";
import { IconRail } from "./IconRail";
import { MobileTopBar } from "./MobileTopBar";
import { OfflineBanner } from "./OfflineBanner";
import { RightRail } from "./RightRail";
import { RightRailSlotContext } from "./RightRailSlot";
import { Sidebar } from "./Sidebar";

/**
 * Below 1160 px the DEV badge floats over the bottom of the page column, so the column ends with room for it
 * and its last row never stays hidden under the badge. From 1160 px the badge sits in the sidebar.
 */
const DEV_BADGE_ROOM = "pb-14 2xl:pb-6";

interface AppShellViewProps {
  pathname: string;
  /** Undefined while loading: the frame renders at once, with placeholders for the numbers. */
  me: MeOut | undefined;
  quests: QuestsOut | undefined;
  children: ReactNode;
}

/**
 * The app frame around every main page. All layouts are rendered and CSS picks one, so the server and the
 * browser always agree on the markup:
 * - below 768 px: a top bar with the stats and a bottom tab bar;
 * - 768–1159 px: the 88 px icon rail; until 1100 px the stats sit in a sticky header over the page;
 * - from 1100 px: the right rail with the stats and the page's cards; from 1160 px the labelled sidebar.
 */
export function AppShellView({ pathname, me, quests, children }: AppShellViewProps) {
  // The settings page portals its section menu into this element, which lives in the right rail.
  const [railSlot, setRailSlot] = useState<HTMLDivElement | null>(null);
  const user = me?.user;
  const devOffset = me?.dev?.clockOffsetSeconds ?? 0;
  const devBadge = showsDevTimeBadge(pathname, devOffset);
  return (
    <ComingSoonProvider>
      <RightRailSlotContext value={railSlot}>
        <a
          href="#main"
          className="sr-only z-(--z-toast) rounded-md bg-page px-4 py-2 text-label text-link uppercase focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:outline-2 focus:outline-focus"
        >
          Skip to content
        </a>
        <Sidebar pathname={pathname} user={user} className="hidden 2xl:flex" />
        <IconRail pathname={pathname} user={user} className="hidden lg:flex 2xl:hidden" />
        <MobileTopBar className="lg:hidden">
          {me ? <StatsBar me={me} placement="topbar" className="w-full" /> : <StatsBarSkeleton className="w-full" />}
        </MobileTopBar>

        <div className="pt-(--topbar-h) pb-[calc(var(--tabbar-h)+env(safe-area-inset-bottom))] lg:pt-0 lg:pb-0 lg:pl-(--rail-w) 2xl:pl-(--sidebar-w)">
          {/* The bottom padding sits on the page column, not here: a sticky rail stops at its container's
              padding, so padding here would push the rail up at the end of a short page. */}
          <div className="mx-auto flex max-w-[1064px] justify-center gap-12 lg:px-6">
            <main id="main" className={cn("max-w-(--col-max) min-w-0 flex-1", devBadge ? DEV_BADGE_ROOM : "lg:pb-6")}>
              <div className="sticky top-0 z-(--z-sticky) hidden h-16 items-center bg-page lg:flex xl:hidden">
                {me ? <StatsBar me={me} placement="header" className="w-full" /> : <StatsBarSkeleton className="w-full" />}
              </div>
              <ContentFadeIn>{children}</ContentFadeIn>
            </main>
            <RightRail pathname={pathname} me={me} quests={quests} slotRef={setRailSlot} className="hidden xl:flex" />
          </div>
        </div>

        <BottomNav pathname={pathname} user={user} className="lg:hidden" />
        {devBadge && <DevTimeBadge offsetSeconds={devOffset} />}
        <OfflineBanner />
      </RightRailSlotContext>
    </ComingSoonProvider>
  );
}
