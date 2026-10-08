"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { LeagueResultModal } from "@/features/path/LeagueResultModal";
import { LegendaryIntroModal } from "@/features/path/LegendaryIntroModal";
import { NeedHeartsModal } from "@/features/path/NeedHeartsModal";
import type { LeagueOutcome, LeagueResultOut } from "@/lib/api/types";
import { LEAGUE_RESULT, ME, ME_VARIANTS } from "../shell/fixtures";
import { Example, GallerySection } from "../shell/parts/GallerySection";
import { PATH } from "./fixtures";

const INTRODUCE_YOURSELF = PATH.units[0].nodes[1];

const RESULTS: Record<LeagueOutcome, LeagueResultOut> = {
  promoted: LEAGUE_RESULT,
  stayed: {
    ...LEAGUE_RESULT,
    finalRank: 12,
    outcome: "stayed",
    newLeague: { tier: 1, name: "Bronze", color: "#D4A880" },
  },
  demoted: {
    ...LEAGUE_RESULT,
    league: { tier: 4, name: "Sapphire", color: "#34B8F4" },
    finalRank: 27,
    outcome: "demoted",
    newLeague: { tier: 3, name: "Gold", color: "#FCD440" },
  },
};

type OpenModal = "legendary" | "legendaryShort" | "needHearts" | LeagueOutcome | null;

/** The path's modals on fixture data, one button each. */
export function ModalsGallery() {
  const [open, setOpen] = useState<OpenModal>(null);
  const close = () => setOpen(null);
  const result = open === "promoted" || open === "stayed" || open === "demoted" ? RESULTS[open] : RESULTS.promoted;
  return (
    <GallerySection title="Modals">
      <Example label="Open a modal">
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="gold" onClick={() => setOpen("legendary")}>
            Legendary intro
          </Button>
          <Button size="sm" variant="gold" onClick={() => setOpen("legendaryShort")}>
            Legendary, gems short
          </Button>
          <Button size="sm" variant="danger" onClick={() => setOpen("needHearts")}>
            Need hearts
          </Button>
          <Button size="sm" onClick={() => setOpen("promoted")}>
            Promoted
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setOpen("stayed")}>
            Stayed
          </Button>
          <Button size="sm" variant="outline" onClick={() => setOpen("demoted")}>
            Demoted
          </Button>
        </div>
      </Example>
      <LegendaryIntroModal
        open={open === "legendary" || open === "legendaryShort"}
        onOpenChange={(next) => !next && close()}
        node={INTRODUCE_YOURSELF}
        gems={open === "legendaryShort" ? 60 : ME.gems}
        starting={false}
        onStart={close}
      />
      <NeedHeartsModal
        open={open === "needHearts"}
        onOpenChange={(next) => !next && close()}
        hearts={ME_VARIANTS.outOfHearts.hearts}
        gems={ME.gems}
        refilling={false}
        practicing={false}
        onRefill={close}
        onPractice={close}
        onUnlimited={close}
      />
      <LeagueResultModal result={result} open={open === "promoted" || open === "stayed" || open === "demoted"} onContinue={close} />
    </GallerySection>
  );
}
