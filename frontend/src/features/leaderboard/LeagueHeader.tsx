import type { LeagueOut } from "@/lib/api/types";
import { BadgeCarousel } from "./BadgeCarousel";
import { LeagueCountdown } from "./LeagueCountdown";
import { promotionSubtitle } from "./leagueCopy";

interface LeagueHeaderProps {
  league: LeagueOut;
  onWeekEnd?: () => void;
}

/**
 * The badges, the league's name, how many advance and the time left. It sticks to the top of the column while
 * the standings scroll: under the phone's top bar, under the tablet's stats header, at the very top on desktop.
 */
export function LeagueHeader({ league, onWeekEnd }: LeagueHeaderProps) {
  return (
    <header className="sticky top-(--topbar-h) z-(--z-sticky) border-b-2 border-line bg-page px-4 pt-6 text-center lg:top-16 xl:top-0">
      <BadgeCarousel tiers={league.tiers} currentTier={league.league.tier} />
      <h1 className="mt-6 mb-2 text-[22px]/[30px] font-extrabold text-fg-strong md:text-title">
        {league.league.name} League
      </h1>
      <p className="px-3 text-body text-fg-2 md:text-subtitle">{promotionSubtitle(league.promoteCount)}</p>
      <LeagueCountdown endsAt={league.weekEndsAt} onEnd={onWeekEnd} />
    </header>
  );
}
