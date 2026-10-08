import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * - `idle`: grey, on an unselected choice.
 * - `selected`: the selected-choice blues.
 * - `inherit`: takes the border and text colours of the tile it sits in (correct, incorrect, ...).
 */
export type HotkeyBadgeTone = "idle" | "selected" | "inherit";

const TONE_CLASSES: Record<HotkeyBadgeTone, string> = {
  idle: "border-line text-fg-3",
  selected: "border-line-selected text-fg-selected",
  inherit: "border-inherit text-inherit",
};

interface HotkeyBadgeProps {
  children: ReactNode;
  tone?: HotkeyBadgeTone;
  className?: string;
}

/**
 * The number key that picks a choice. It only appears where a keyboard is likely: a fine pointer that can
 * hover, on screens at least 700 px wide. Decorative for screen readers; give the choice `aria-keyshortcuts`.
 */
export function HotkeyBadge({ children, tone = "idle", className }: HotkeyBadgeProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "hidden size-[30px] shrink-0 place-items-center rounded-sm border-2 text-[15px] leading-none font-extrabold",
        "[@media(hover:hover)_and_(pointer:fine)]:md:grid",
        TONE_CLASSES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
