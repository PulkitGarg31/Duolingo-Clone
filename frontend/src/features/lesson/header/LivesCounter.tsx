"use client";

import { HeartIcon } from "@/components/icons/HeartIcon";
import type { LivesOut } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { LostHeart, useLossCount } from "./HeartsCounter";

/** Legendary's three lives, drawn as hearts that grey out one by one ("3 mistakes and it's over"). */
export function LivesCounter({ lives }: { lives: LivesOut }) {
  return (
    <div role="img" aria-label={`${lives.left} of ${lives.max} lives left`} className="flex shrink-0 items-center gap-1">
      {Array.from({ length: lives.max }, (_, index) => (
        <Life key={index} alive={index < lives.left} />
      ))}
    </div>
  );
}

function Life({ alive }: { alive: boolean }) {
  const losses = useLossCount(alive ? 1 : 0);
  return (
    <span className="relative block">
      <span key={losses} className={cn("block", losses > 0 && "animate-[heart-squash_300ms_ease-in-out]")}>
        <HeartIcon size={26} variant={alive ? "full" : "empty"} />
      </span>
      {losses > 0 && <LostHeart key={`ghost-${losses}`} size={26} />}
    </span>
  );
}
