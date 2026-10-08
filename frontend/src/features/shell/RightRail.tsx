import type { Ref } from "react";
import { FriendsCard } from "@/features/rail/FriendsCard";
import { LeagueCard } from "@/features/rail/LeagueCard";
import { QuestsCard } from "@/features/rail/QuestsCard";
import { RailCardSkeleton } from "@/features/rail/RailCardSkeleton";
import { SuperPromoCard } from "@/features/rail/SuperPromoCard";
import { StatsBar } from "@/features/stats/StatsBar";
import { StatsBarSkeleton } from "@/features/stats/StatsBarSkeleton";
import type { MeOut, QuestsOut } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { RailFooter } from "./RailFooter";
import { railLayoutFor, type RailBlock } from "./railLayout";

interface RightRailProps {
  pathname: string;
  me: MeOut | undefined;
  quests: QuestsOut | undefined;
  /** Receives the settings page's slot element. */
  slotRef: Ref<HTMLDivElement>;
  className?: string;
}

/**
 * The right column of wide screens: the stats row, then the page's own stack of cards, then the footer. It
 * sticks to the top and scrolls on its own when taller than the window.
 */
export function RightRail({ pathname, me, quests, slotRef, className }: RightRailProps) {
  const { width, blocks } = railLayoutFor(pathname);
  return (
    <aside
      className={cn(
        "sticky top-0 max-h-dvh shrink-0 flex-col gap-6 self-start overflow-y-auto pt-6 pb-6 [scrollbar-width:none]",
        width === 380 ? "w-[380px]" : "w-[368px]",
        className,
      )}
    >
      {blocks.map((block) => (
        <RailBlockView key={block} block={block} me={me} quests={quests} slotRef={slotRef} />
      ))}
    </aside>
  );
}

interface RailBlockViewProps {
  block: RailBlock;
  me: MeOut | undefined;
  quests: QuestsOut | undefined;
  slotRef: Ref<HTMLDivElement>;
}

function RailBlockView({ block, me, quests, slotRef }: RailBlockViewProps) {
  switch (block) {
    case "stats":
      return me ? <StatsBar me={me} placement="rail" /> : <StatsBarSkeleton className="h-11" />;
    case "league":
      return me ? <LeagueCard league={me.league} /> : <RailCardSkeleton />;
    case "quests":
      return quests ? <QuestsCard quests={quests} /> : <RailCardSkeleton />;
    case "super":
      return <SuperPromoCard />;
    case "friends":
      return <FriendsCard />;
    case "settingsNav":
      return <div ref={slotRef} />;
    case "footer":
      return <RailFooter />;
  }
}
