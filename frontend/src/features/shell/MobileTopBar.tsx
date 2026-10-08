import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** The phone's fixed top bar, holding the stats row. */
export function MobileTopBar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-(--z-topbar) flex h-(--topbar-h) items-center border-b-2 border-line bg-page px-2.5 xs:px-4",
        className,
      )}
    >
      {children}
    </header>
  );
}
