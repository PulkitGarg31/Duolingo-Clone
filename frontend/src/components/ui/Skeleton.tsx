"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/cn";

interface SkeletonProps {
  /** Size and corner radius, e.g. "h-[82px] w-full rounded-md". */
  className?: string;
  style?: CSSProperties;
}

/**
 * A grey placeholder block with a moving shine. When motion is reduced the shine is dropped instead of being
 * frozen half-way across the block.
 */
export function Skeleton({ className, style }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "animate-shimmer bg-skeleton bg-[linear-gradient(90deg,transparent,var(--c-skeleton-shine)_50%,transparent)] bg-size-[200%_100%]",
        "[[data-motion=reduced]_&]:bg-none",
        className,
      )}
      style={style}
    />
  );
}

interface SkeletonGroupProps {
  /** The skeleton layout, built from `Skeleton` blocks. */
  children: ReactNode;
  /** Fast loads finish before this and never flash a skeleton. */
  delayMs?: number;
  /** What screen readers announce while the skeleton shows. */
  label?: string;
  className?: string;
}

/** Shows its skeleton only once loading has taken longer than `delayMs` (200 ms by default). */
export function SkeletonGroup({ children, delayMs = 200, label = "Loading", className }: SkeletonGroupProps) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShown(true), delayMs);
    return () => clearTimeout(timer);
  }, [delayMs]);

  return (
    <div role="status" className={className}>
      {shown && (
        <>
          <span className="sr-only">{label}</span>
          {children}
        </>
      )}
    </div>
  );
}
