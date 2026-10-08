import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** The `title-xl` type role: 32/40 from 700 px, 25/31 on phones. */
export const TITLE_XL = "text-[25px]/[31px] font-extrabold md:text-title-xl";

interface CelebrationTextProps {
  /** Colour, spacing and width; the type role is fixed. */
  className?: string;
  children: ReactNode;
}

/** The heading of a celebration screen. */
export function CelebrationTitle({ className, children }: CelebrationTextProps) {
  return <h1 className={cn(TITLE_XL, "text-balance", className)}>{children}</h1>;
}

/** The line under the heading, in the `subtitle` role: 19/27 from 700 px, 17/25 on phones. */
export function CelebrationBody({ className, children }: CelebrationTextProps) {
  return <p className={cn("text-[17px]/[25px] font-semibold text-balance md:text-subtitle", className)}>{children}</p>;
}
