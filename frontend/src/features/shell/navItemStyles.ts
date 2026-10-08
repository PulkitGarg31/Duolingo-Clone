import { cn } from "@/lib/cn";

/**
 * - `sidebar`: a full-width row with the icon and an uppercase label (≥ 1160 px);
 * - `rail`: an icon-only square with a hover label beside it (768–1159 px);
 * - `tab`: a 48 px tile in the phone's bottom bar.
 */
export type NavLayout = "sidebar" | "rail" | "tab";

const LAYOUT_CLASSES: Record<NavLayout, string> = {
  sidebar: "h-[52px] w-full gap-5 rounded-md px-2 py-1 [&>:first-child]:ml-1.5",
  rail: "group relative h-[52px] w-14 justify-center rounded-md",
  tab: "size-12 justify-center rounded-sm",
};

/** A menu item's box; the current page's item is light blue with a blue outline, as on Duolingo. */
export function navItemClassName(layout: NavLayout, active: boolean): string {
  return cn(
    "flex cursor-pointer items-center border-2 outline-none",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
    LAYOUT_CLASSES[layout],
    active ? "border-line-selected bg-selected" : "border-transparent hover:bg-subtle",
  );
}

/** The sidebar label: 15 px uppercase, grey, or blue on the current page. */
export function navLabelClassName(active: boolean): string {
  return cn("text-[15px] leading-[18px] font-extrabold tracking-[0.8px] uppercase", active ? "text-link" : "text-fg-2");
}
