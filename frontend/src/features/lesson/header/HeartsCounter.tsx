"use client";

import { useState } from "react";
import { HeartIcon } from "@/components/icons/HeartIcon";
import { cn } from "@/lib/cn";
import { RollingNumber } from "./RollingNumber";

/** Counts how many times `count` went down, so each loss can replay its animation through a new React key. */
export function useLossCount(count: number): number {
  const [previous, setPrevious] = useState(count);
  const [losses, setLosses] = useState(0);
  if (count !== previous) {
    setPrevious(count);
    if (count < previous) setLosses(losses + 1);
  }
  return losses;
}

/** A heart that was just lost: a copy drops 50 px and fades while the real one squashes. */
export function LostHeart({ size }: { size: number }) {
  return (
    <span aria-hidden="true" className="pointer-events-none absolute inset-0 animate-heart-drop">
      <HeartIcon size={size} />
    </span>
  );
}

/**
 * The lesson's hearts: a red heart and the count. Losing one drops a ghost heart, squashes the icon and
 * rolls the number down; at the last heart the icon keeps pulsing.
 */
export function HeartsCounter({ hearts }: { hearts: number }) {
  const losses = useLossCount(hearts);
  return (
    <div role="img" aria-label={`${hearts} hearts`} className="flex min-w-12 shrink-0 items-center justify-end gap-2">
      <span className={cn("relative block", hearts === 1 && "animate-last-heart")}>
        <span key={losses} className={cn("block", losses > 0 && "animate-[heart-squash_300ms_ease-in-out]")}>
          <HeartIcon size={28} />
        </span>
        {losses > 0 && <LostHeart key={`ghost-${losses}`} size={28} />}
      </span>
      <RollingNumber value={hearts} className="text-stat text-heart" />
    </div>
  );
}
