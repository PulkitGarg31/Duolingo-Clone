"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export type StatTone = "xp" | "time" | "accuracy";

/** Each card's colour: bee for XP, macaw for time, owl for accuracy. */
const TONE_CLASSES: Record<StatTone, string> = {
  xp: "[--stat:var(--duo-bee)]",
  time: "[--stat:var(--duo-macaw)]",
  accuracy: "[--stat:var(--duo-owl)]",
};

interface StatFrameProps {
  tone: StatTone;
  label: string;
  icon: ReactNode;
  /** The card's turn has come: it rises into place. Until then it keeps its space, unseen. */
  shown: boolean;
  /** Renders the value; `landed` turns true once the card has settled, which is when a number starts counting. */
  children: (landed: boolean) => ReactNode;
}

/**
 * One stat card of the lesson summary: a coloured card holding a white label, over a white box with a border
 * of the same colour, so the colour reads as a tab around the label. 163 px wide at most, narrower on phones.
 */
export function StatFrame({ tone, label, icon, shown, children }: StatFrameProps) {
  const [landed, setLanded] = useState(false);
  return (
    <div
      className={cn(
        "relative max-w-[163px] min-w-0 flex-1 basis-0 overflow-hidden rounded-lg bg-(--stat)",
        TONE_CLASSES[tone],
        // The card rises 30 px while its colour fills in, then the box inside pops.
        shown ? "animate-[stat-rise_200ms_ease-in-out_both]" : "invisible",
      )}
      onAnimationEnd={(event) => {
        if (event.target === event.currentTarget) setLanded(true);
      }}
    >
      <dt className="p-1 text-caption text-on-color-fixed uppercase">{label}</dt>
      <dd
        className={cn(
          "flex h-[70px] items-center justify-center gap-1 rounded-lg border-2 border-(--stat) bg-page",
          "text-[20px] leading-none font-extrabold text-(--stat)",
          shown && "animate-[stat-inner_100ms_ease-out_100ms_both]",
        )}
      >
        {icon}
        {children(landed)}
      </dd>
    </div>
  );
}
