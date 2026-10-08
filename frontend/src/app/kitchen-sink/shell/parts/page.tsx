"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { ComingSoonProvider } from "@/features/shell/ComingSoon";
import { ErrorState } from "@/features/shell/ErrorState";
import { NavItemLink } from "@/features/shell/NavItemLink";
import { NAV_ITEMS } from "@/features/shell/navItems";
import { WakeScreen } from "@/features/shell/WakeScreen";
import { ME } from "../fixtures";
import { SeedQueryCache } from "../SeedQueryCache";
import { SEEDED_LEAF_DATA } from "../seedEntries";
import { Example, GallerySection } from "./GallerySection";
import { RailGallery } from "./RailGallery";
import { StatsGallery } from "./StatsGallery";

/** The app frame's parts one by one: stats and their popovers, rail cards, menu items and system screens. */
export default function ShellPartsKitchenSinkPage() {
  const [wake, setWake] = useState<"waking" | "slow" | "failed" | null>(null);
  return (
    <ComingSoonProvider>
      <SeedQueryCache entries={SEEDED_LEAF_DATA} />
      <main className="mx-auto flex max-w-[1400px] flex-col gap-12 px-6 py-10">
        <h1 className="text-title-lg text-fg-strong">App frame parts</h1>
        <StatsGallery />
        <RailGallery />

        <GallerySection title="Menu items">
          <Example label="Sidebar" className="w-[224px]">
            <ul className="flex flex-col gap-2">
              {NAV_ITEMS.map((item) => (
                <li key={item.key}>
                  <NavItemLink item={item} active={item.key === "learn"} layout="sidebar" user={ME.user} />
                </li>
              ))}
            </ul>
          </Example>
          <Example label="Icon rail">
            <ul className="flex flex-col gap-2">
              {NAV_ITEMS.map((item) => (
                <li key={item.key}>
                  <NavItemLink item={item} active={item.key === "quests"} layout="rail" user={ME.user} />
                </li>
              ))}
            </ul>
          </Example>
          <Example label="Bottom tabs">
            <ul className="flex gap-2">
              {NAV_ITEMS.map((item) => (
                <li key={item.key}>
                  <NavItemLink item={item} active={item.key === "profile"} layout="tab" user={undefined} />
                </li>
              ))}
            </ul>
          </Example>
        </GallerySection>

        <GallerySection title="System screens">
          <Example label="Error boundary" className="w-[420px]">
            <div className="rounded-lg border-2 border-line">
              <ErrorState error={Object.assign(new Error("Render failed"), { digest: "3141592653" })} onRetry={() => undefined} />
            </div>
          </Example>
          <Example label="Wake screen">
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => setWake("waking")}>
                Waking
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setWake("slow")}>
                After 20 s
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setWake("failed")}>
                Unreachable
              </Button>
            </div>
          </Example>
        </GallerySection>
      </main>
      {wake && (
        <>
          <WakeScreen failed={wake === "failed"} slow={wake === "slow"} onRetry={() => setWake(null)} />
          <div className="fixed top-4 right-4 z-(--z-dev)">
            <Button size="sm" variant="outline" onClick={() => setWake(null)}>
              Close preview
            </Button>
          </div>
        </>
      )}
    </ComingSoonProvider>
  );
}
