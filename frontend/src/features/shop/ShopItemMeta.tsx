"use client";

import type { ShopItemOut } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { useCountdown } from "@/lib/time/serverClock";
import { itemMetaLine, type MetaLine } from "./shopItems";

const TONE_CLASSES: Record<MetaLine["tone"], string> = {
  gem: "text-gem",
  boost: "text-beetle",
};

interface ShopItemMetaProps {
  item: ShopItemOut;
  /** Called once when a running boost runs out. */
  onBoostEnd?: () => void;
}

/** "1 / 2 equipped" for Streak Freezes; "Active · 12 min left" while an XP Boost runs, ticking down. */
export function ShopItemMeta({ item, onBoostEnd }: ShopItemMetaProps) {
  const boostMsLeft = useCountdown(item.activeUntil, onBoostEnd);
  const line = itemMetaLine(item, boostMsLeft);
  if (!line) return null;
  return <p className={cn("mt-1 text-[15px] leading-[22px] font-extrabold", TONE_CLASSES[line.tone])}>{line.text}</p>;
}
