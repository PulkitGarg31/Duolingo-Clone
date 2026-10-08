import { cn } from "@/lib/cn";

/**
 * The icon rail's label, shown beside an item on hover or keyboard focus (the item must have the `group` class).
 * Pure CSS: it repeats the item's accessible name, so screen readers skip it.
 */
export function RailTooltip({ label }: { label: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute top-1/2 left-[calc(100%+16px)] z-(--z-popover) -translate-y-1/2 whitespace-nowrap",
        "rounded-sm bg-(--duo-wolf) px-3 py-[7px] text-[15px] leading-[18px] font-extrabold text-on-color-fixed",
        "dark:bg-inverse dark:text-page",
        "opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100",
        // An open menu (MORE) replaces the label.
        "group-data-[state=open]:opacity-0",
      )}
    >
      {label}
    </span>
  );
}
