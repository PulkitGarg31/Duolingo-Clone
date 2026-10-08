"use client";

import { useRef } from "react";
import { LegendaryTrophyIcon } from "@/components/icons";
import { Confetti } from "@/components/mascot";
import { COMPLETION_COPY } from "@/lib/lesson/copy";
import { CelebrationFooter } from "./CelebrationFooter";
import { CelebrationScreen } from "./CelebrationScreen";
import { useSoundOnce } from "./celebrationSound";
import { CelebrationBody, CelebrationTitle } from "./CelebrationText";
import { Rays } from "./Rays";

interface LegendaryScreenProps {
  nodeTitle: string;
  active: boolean;
  onContinue: () => void;
}

/** A passed legendary challenge: the gold trophy in turning rays on the dark legendary background. */
export function LegendaryScreen({ nodeTitle, active, onContinue }: LegendaryScreenProps) {
  const trophy = useRef<HTMLDivElement>(null);
  useSoundOnce("achievement");
  return (
    <CelebrationScreen tone="legendary" footer={<CelebrationFooter active={active} onContinue={onContinue} variant="gold" />}>
      <div className="relative grid size-[260px] place-items-center">
        <Rays color="color-mix(in srgb, var(--duo-gold-shine) 30%, transparent)" className="absolute inset-0" />
        <div ref={trophy} className="relative animate-[grow-in_600ms_ease-in-out_both]">
          <LegendaryTrophyIcon size={160} />
        </div>
      </div>
      <p className="text-caption text-bee/80 uppercase">{nodeTitle}</p>
      <CelebrationTitle className="mt-3 max-w-[480px] text-bee">{COMPLETION_COPY.legendaryTitle}</CelebrationTitle>
      <CelebrationBody className="mt-3 max-w-[420px] text-on-color-fixed/80">{COMPLETION_COPY.legendaryBody}</CelebrationBody>
      <Confetti variant="burst" origin={trophy} />
    </CelebrationScreen>
  );
}
