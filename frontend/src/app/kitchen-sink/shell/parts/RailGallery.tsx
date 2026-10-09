"use client";

import { FriendsCard } from "@/features/rail/FriendsCard";
import { GuestCard } from "@/features/rail/GuestCard";
import { LeagueCard } from "@/features/rail/LeagueCard";
import { QuestsCard } from "@/features/rail/QuestsCard";
import { RailCardSkeleton } from "@/features/rail/RailCardSkeleton";
import { SuperPromoCard } from "@/features/rail/SuperPromoCard";
import { RailFooter } from "@/features/shell/RailFooter";
import type { MeLeague } from "@/lib/api/types";
import { ME, ME_VARIANTS, QUESTS, QUESTS_DONE } from "../fixtures";
import { Example, GallerySection } from "./GallerySection";

const SILVER = ME.league;

/** One example per status line rule of the league card. */
const LEAGUE_STANDINGS: ReadonlyArray<readonly [label: string, league: MeLeague]> = [
  ["Top 3", { ...SILVER, rank: 2, zone: "promotion" }],
  ["Promotion zone", { ...SILVER, rank: 9, zone: "promotion" }],
  ["Close to demotion", { ...SILVER, rank: 22 }],
  ["Demotion zone", { ...SILVER, rank: 26, zone: "demotion" }],
  ["Mid-table", SILVER],
];

/** Every right-rail card in each of its states. */
export function RailGallery() {
  return (
    <>
      <GallerySection title="League card">
        <Example label="Locked" className="w-[368px]">
          <LeagueCard league={ME_VARIANTS.newcomer.league} />
        </Example>
        <Example label="Not joined this week" className="w-[368px]">
          <LeagueCard league={ME_VARIANTS.notJoined.league} />
        </Example>
        {LEAGUE_STANDINGS.map(([label, league]) => (
          <Example key={label} label={label} className="w-[368px]">
            <LeagueCard league={league} />
          </Example>
        ))}
      </GallerySection>

      <GallerySection title="Quests, Super, friends and footer">
        <Example label="Daily quests" className="w-[368px]">
          <QuestsCard quests={QUESTS} />
        </Example>
        <Example label="All complete" className="w-[368px]">
          <QuestsCard quests={QUESTS_DONE} />
        </Example>
        <Example label="Super promo" className="w-[368px]">
          <SuperPromoCard />
        </Example>
        <Example label="Friends (profile rail)" className="w-[368px]">
          <FriendsCard />
        </Example>
        <Example label="Guest (demo learner)" className="w-[368px]">
          <GuestCard />
        </Example>
        <Example label="Loading" className="w-[368px]">
          <RailCardSkeleton />
        </Example>
        <Example label="Footer" className="w-[368px]">
          <RailFooter />
        </Example>
      </GallerySection>
    </>
  );
}
