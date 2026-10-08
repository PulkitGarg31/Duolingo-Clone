"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { PathSkeleton } from "@/features/path/PathSkeleton";
import { UnitBanner } from "@/features/path/UnitBanner";
import { UnitSection } from "@/features/path/UnitSection";
import type { PathNodeOut } from "@/lib/api/types";
import { Example, GallerySection } from "../shell/parts/GallerySection";
import { PATH, PATH_DRINKS_DONE, PATH_DRINKS_TWO } from "./fixtures";

/** "Drinks" through its last lessons: the ring fills, then the node completes and the next ones unlock. */
const STEPS = [PATH, PATH_DRINKS_TWO, PATH_DRINKS_DONE] as const;
const STEP_LABELS = ["Lesson 2 of 3 next", "Lesson 3 of 3 next", "Drinks completed"] as const;

/** The unit banners, a unit replaying the return from a lesson, and the loading skeleton. */
export function UnitsGallery() {
  const [step, setStep] = useState(0);
  const [openNodeId, setOpenNodeId] = useState<number | null>(null);
  const [claimed, setClaimed] = useState(false);
  const path = STEPS[step];
  const unit = path.units[1];
  const shownUnit = claimed
    ? { ...unit, nodes: unit.nodes.map((node): PathNodeOut => (node.kind === "chest" ? { ...node, state: "completed" } : node)) }
    : unit;

  return (
    <>
      <GallerySection title="Unit banners">
        {PATH.units.map((banner) => (
          <Example key={banner.id} label={`Unit ${banner.number}`} className="w-[600px]">
            <UnitBanner unit={banner} />
          </Example>
        ))}
      </GallerySection>

      <GallerySection title="Back from a lesson">
        <Example label={STEP_LABELS[step]} className="w-[600px]">
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setClaimed(false);
                setStep((current) => (current + 1) % STEPS.length);
              }}
            >
              Play next lesson
            </Button>
          </div>
          <UnitSection
            unit={shownUnit}
            unitIndex={1}
            gems={820}
            openNodeId={openNodeId}
            onOpenNodeChange={setOpenNodeId}
            pending={null}
            onAction={() => setOpenNodeId(null)}
            onClaimChest={() => setClaimed(true)}
          />
          <UnitSection
            unit={path.units[2]}
            unitIndex={2}
            gems={820}
            openNodeId={openNodeId}
            onOpenNodeChange={setOpenNodeId}
            pending={null}
            onAction={() => setOpenNodeId(null)}
            onClaimChest={() => undefined}
          />
        </Example>
        <Example label="Loading" className="w-[600px]">
          <PathSkeleton />
        </Example>
      </GallerySection>
    </>
  );
}
