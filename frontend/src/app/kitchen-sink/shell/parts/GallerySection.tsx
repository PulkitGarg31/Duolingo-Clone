import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** A titled block of the gallery. */
export function GallerySection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-heading text-fg">{title}</h2>
      <div className="flex flex-wrap items-start gap-6">{children}</div>
    </section>
  );
}

/** A caption over one example. */
export function Example({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <figure className={cn("flex flex-col gap-2", className)}>
      <figcaption className="text-caption text-fg-3 uppercase">{label}</figcaption>
      {children}
    </figure>
  );
}

/** The desktop popover's panel, drawn in place so its content can be compared side by side. */
export function PopoverFrame({ width, children, className }: { width: number; children: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-[15px] border-2 border-line bg-page px-4 py-6", className)} style={{ width }}>
      {children}
    </div>
  );
}
