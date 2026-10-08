import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * - `beetle`: COMING SOON and DEV.
 * - `bee`: PERFECT, on a perfect-week streak card.
 * - `super`: the SUPER badge on the gradient, the only gradient in the product besides the legendary rays.
 */
export type PillTone = "beetle" | "bee" | "super";

const TONE_CLASSES: Record<PillTone, string> = {
  beetle: "h-5 rounded-full bg-beetle px-2 text-[12px] leading-5 font-extrabold tracking-[0.04em] text-on-color-fixed",
  bee: "h-5 rounded-full bg-bee px-2 text-[12px] leading-5 font-extrabold tracking-[0.04em] text-(--unit-gold-dark)",
  // The gradient's stops exist only here, so they have no palette token.
  super:
    "rounded-sm bg-[linear-gradient(90deg,#26FF55,#268BFF_50%,#FC55FF)] px-2 py-0.5 text-[12px] leading-4 font-black text-on-color-fixed",
};

interface PillProps {
  tone: PillTone;
  /** Uppercased by CSS, so screen readers hear words rather than letters. */
  children: ReactNode;
  className?: string;
}

/** A small uppercase label: COMING SOON, DEV, PERFECT, SUPER. */
export function Pill({ tone, children, className }: PillProps) {
  return (
    <span className={cn("inline-flex shrink-0 items-center whitespace-nowrap uppercase", TONE_CLASSES[tone], className)}>
      {children}
    </span>
  );
}
