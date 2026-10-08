"use client";

import { GemBowlIcon } from "@/components/icons/GemBowlIcon";
import { GemChestIcon } from "@/components/icons/GemChestIcon";
import { GemPileIcon } from "@/components/icons/GemPileIcon";
import { CardButton, ComingSoonPill } from "@/components/ui";
import { useComingSoon } from "@/features/shell/ComingSoon";

const PACKS = [
  { name: "Handful", Art: GemPileIcon },
  { name: "Pile", Art: GemBowlIcon },
  { name: "Chest", Art: GemChestIcon },
] as const;

/** Gem packs for real money are not part of this demo: three tiles that open the Coming soon modal. */
export function GemPacks() {
  const showComingSoon = useComingSoon();
  return (
    <section className="mt-8">
      <h2 className="mb-4 text-[22px] leading-7 font-extrabold text-fg-strong md:text-heading">Gems</h2>
      <ul className="grid grid-cols-3 gap-3 sm:gap-4">
        {PACKS.map(({ name, Art }) => (
          <li key={name}>
            <CardButton
              padding="md"
              onClick={() => showComingSoon("gem packs")}
              aria-label={`${name} of gems: coming soon`}
              className="flex w-full flex-col items-center gap-2"
            >
              <Art size={72} className="h-16 w-auto sm:h-[72px]" />
              <span className="text-body font-extrabold text-fg">{name}</span>
              <ComingSoonPill short />
            </CardButton>
          </li>
        ))}
      </ul>
    </section>
  );
}
