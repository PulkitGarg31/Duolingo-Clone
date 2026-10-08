import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * - `plain`: the page colour, for the summary, streak, quest and heart screens.
 * - `purple`: timed practice, the same in both themes. `--surface` gives the white CONTINUE its purple label
 *   and lilac lip, and the page colour is pinned to white here so that button stays white in dark mode.
 * - `legendary`: Duolingo's near-black legendary background, the same in both themes.
 */
export type ScreenTone = "plain" | "purple" | "legendary";

const TONE_CLASSES: Record<ScreenTone, string> = {
  plain: "bg-page text-fg",
  purple: "bg-(--duo-betta) text-on-color-fixed [--surface:var(--duo-betta)] [--c-bg:#FFFFFF]",
  legendary: "bg-[#181818] text-on-color-fixed",
};

interface CelebrationScreenProps {
  tone?: ScreenTone;
  /** Decoration drawn behind everything and clipped to the screen (floating bubbles). */
  backdrop?: ReactNode;
  /** The CelebrationFooter. */
  footer: ReactNode;
  children: ReactNode;
}

/**
 * The frame of every screen after a session: the content centred in the viewport above a footer that stays
 * at the bottom edge. On white screens the footer is a page-coloured bar under a 2 px rule (from 700 px), like
 * the lesson footer; on coloured screens it is part of the coloured surface.
 */
export function CelebrationScreen({ tone = "plain", backdrop, footer, children }: CelebrationScreenProps) {
  return (
    <div className={cn("relative flex min-h-dvh flex-col", TONE_CLASSES[tone])}>
      {backdrop && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-clip">
          {backdrop}
        </div>
      )}
      <div className="relative flex flex-1 flex-col items-center justify-center px-4 pt-10 pb-8 text-center">
        {children}
      </div>
      <footer className={cn("sticky bottom-0 z-10", tone === "plain" && "bg-page md:border-t-2 md:border-line")}>
        {footer}
      </footer>
    </div>
  );
}
