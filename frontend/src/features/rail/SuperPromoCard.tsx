"use client";

import { Owl } from "@/components/mascot";
import { Button, Pill } from "@/components/ui";
import { useComingSoon } from "@/features/shell/ComingSoon";
import { RailCard } from "./RailCard";

/** The Super subscription ad. Super is a placeholder in this app, so the offer opens Coming soon. */
export function SuperPromoCard() {
  const showComingSoon = useComingSoon();
  return (
    <RailCard>
      <div className="relative pr-24">
        <Pill tone="super">Super</Pill>
        <h2 className="mt-3 text-card-title text-fg">Try Super for free</h2>
        <p className="mt-1 text-small text-fg-2">No ads, personalized practice, and unlimited Legendary!</p>
        <Owl pose="cape" size={88} className="absolute -top-1 -right-1" />
      </div>
      <Button variant="super" fullWidth className="mt-4" onClick={() => showComingSoon("Super")}>
        Try 2 weeks free
      </Button>
    </RailCard>
  );
}
