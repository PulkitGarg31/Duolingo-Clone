import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** The footer's inner grid: one column on phones, five from 700 px (SKIP in the first, the action in the last). */
export const FOOTER_GRID =
  "mx-auto grid max-w-[1000px] grid-cols-1 items-center gap-x-4 gap-y-3 px-4 pt-4 pb-[calc(16px+env(safe-area-inset-bottom))] md:min-h-[140px] md:grid-cols-5 md:px-10 md:py-0";

/** The plain lesson footer: a 2 px top rule on wide screens, nothing on phones. */
export function FooterFrame({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("bg-page md:border-t-2 md:border-line", className)}>
      <div className={FOOTER_GRID}>{children}</div>
    </div>
  );
}
