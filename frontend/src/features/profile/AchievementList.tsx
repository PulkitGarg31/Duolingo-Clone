"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui";
import { useComingSoon } from "@/features/shell/ComingSoon";
import type { AchievementOut } from "@/lib/api/types";
import { AchievementRow, ComingSoonAchievementRow } from "./AchievementRow";

/** "/profile#achievements" (the achievement modal's VIEW ACHIEVEMENTS) lands here with the list opened. */
const SECTION_ID = "achievements";
const COLLAPSED_ROWS = 3;

/** Listed after the API's achievements: they need friends and profile pictures, which are not built yet. */
const COMING_SOON = [
  { code: "friendly", name: "Friendly", description: "Follow 3 friends", feature: "the friends list" },
  { code: "photogenic", name: "Photogenic", description: "Add a profile picture", feature: "profile pictures" },
] as const;

interface AchievementListProps {
  achievements: readonly AchievementOut[];
}

/**
 * The achievements card. It shows three rows; VIEW ALL opens the full list in place, so the link never leads
 * to a page that does not exist.
 */
export function AchievementList({ achievements }: AchievementListProps) {
  const showComingSoon = useComingSoon();
  const linkedHere = useIsHashTarget(SECTION_ID);
  const [expandedByUser, setExpandedByUser] = useState<boolean | null>(null);
  const expanded = expandedByUser ?? linkedHere;
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (linkedHere) sectionRef.current?.scrollIntoView({ block: "start" });
  }, [linkedHere]);

  const shown = expanded ? achievements : achievements.slice(0, COLLAPSED_ROWS);
  return (
    <section ref={sectionRef} id={SECTION_ID} aria-labelledby="achievements-title" className="scroll-mt-20">
      <div className="flex items-baseline justify-between">
        <h2 id="achievements-title" className="text-heading text-fg-strong">
          Achievements
        </h2>
        <Button
          variant="ghost"
          size="inline"
          aria-expanded={expanded}
          aria-controls="achievement-rows"
          onClick={() => setExpandedByUser(!expanded)}
        >
          {expanded ? "Show less" : "View all"}
        </Button>
      </div>
      <ul id="achievement-rows" className="mt-4 overflow-hidden rounded-lg border-2 border-line">
        {shown.map((achievement) => (
          <li key={achievement.code} className="border-t-2 border-line first:border-t-0">
            <AchievementRow achievement={achievement} />
          </li>
        ))}
        {expanded &&
          COMING_SOON.map(({ feature, ...item }) => (
            <li key={item.code} className="border-t-2 border-line">
              <ComingSoonAchievementRow {...item} onSelect={() => showComingSoon(feature)} />
            </li>
          ))}
      </ul>
    </section>
  );
}

function subscribeToHash(onChange: () => void): () => void {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

/** Whether the URL's hash names `id`; always false while rendering on the server. */
function useIsHashTarget(id: string): boolean {
  return useSyncExternalStore(subscribeToHash, () => window.location.hash === `#${id}`, () => false);
}
