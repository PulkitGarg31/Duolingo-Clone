"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { AnimatePresence, motion, useDragControls, type PanInfo } from "motion/react";
import type { CSSProperties, KeyboardEvent, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { hasRecentInput } from "./inputRecency";
import { EASE_IN, EASE_OUT, EASE_SPRING, useFadeSeconds } from "./transitions";

/**
 * Where the panel sits: a centred card, a sheet rising from the bottom, one dropping from under the top bar, or
 * a sheet covering the whole screen.
 */
export type DialogPlacement = "center" | "bottom" | "top" | "full";

/** A swipe closes the sheet once it travels this far or flicks this fast; shorter swipes spring back. */
const SWIPE_CLOSE_DISTANCE_PX = 100;
const SWIPE_CLOSE_VELOCITY = 500;

type Fade = (seconds: number) => number;

/** The scrim fades in over 300 ms and out over 150 ms. */
function scrimMotion(fade: Fade) {
  return {
    initial: { opacity: 0 },
    animate: { opacity: 1, transition: { duration: fade(0.3) } },
    exit: { opacity: 0, transition: { duration: fade(0.15) } },
  };
}

/** A centred card pops in (scale .9 → 1, 250 ms spring); sheets slide in from their edge. All exit in 150 ms. */
function panelMotion(placement: DialogPlacement, fade: Fade) {
  switch (placement) {
    case "center":
      return {
        initial: { opacity: 0, scale: 0.9 },
        animate: { opacity: 1, scale: 1, transition: { duration: fade(0.25), ease: EASE_SPRING } },
        exit: { opacity: 0, scale: 0.95, transition: { duration: fade(0.15), ease: EASE_IN } },
      };
    case "bottom":
    case "full":
      return {
        initial: { y: "100%" },
        animate: { y: 0, transition: { duration: 0.25, ease: EASE_OUT } },
        exit: { y: "100%", transition: { duration: 0.15, ease: EASE_IN } },
      };
    case "top":
      return {
        initial: { y: "-100%" },
        animate: { y: 0, transition: { duration: 0.2, ease: EASE_OUT } },
        exit: { y: "-100%", transition: { duration: 0.15, ease: EASE_IN } },
      };
  }
}

/** The full-screen layer that positions the panel; it lets clicks fall through to the scrim. */
const FRAME_CLASSES: Record<DialogPlacement, string> = {
  center: "top-0 items-center p-6",
  bottom: "top-0 items-end",
  full: "top-0 items-end",
  // Clipped at the top bar's edge, so the sheet appears to slide out from under it.
  top: "top-(--topbar-h) items-start overflow-hidden",
};

const PANEL_CLASSES: Record<DialogPlacement, string> = {
  center: "max-h-[calc(100dvh-48px)] rounded-lg p-6 xl:p-[30px]",
  bottom:
    "max-h-[calc(100dvh-24px)] w-full rounded-t-lg px-4 pt-6 pb-[calc(24px+env(safe-area-inset-bottom))] shadow-(--shadow-sheet)",
  // Edge to edge, a flex column so the content can pin its buttons to the bottom; it scrolls when too tall, and
  // its padding keeps clear of the notch and the home indicator.
  full: "flex h-dvh w-full flex-col px-4 pt-[calc(24px+env(safe-area-inset-top))] pb-[calc(24px+env(safe-area-inset-bottom))]",
  top: "max-h-[calc(100dvh-var(--topbar-h))] w-full rounded-b-lg border-b-2 border-line px-4 py-6",
};

/** What Tab can reach inside the panel; the panel itself takes focus from script only. */
const TABBABLE =
  "a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex='-1'])";

/**
 * Called as the panel mounts, after any `autoFocus` control inside it has taken focus. A dialog the learner just
 * opened keeps that focus (or gets Radix's: the first control). One that opened on its own (on page load, or
 * when data arrived) moves focus to the panel instead: browsers ring a button that script focuses before any
 * input, and nobody asked for that button. Tab still goes straight to the first control.
 */
function focusPanelIfUnasked(panel: HTMLDivElement | null) {
  if (panel && !hasRecentInput()) panel.focus({ preventScroll: true });
}

/** From the panel itself, Shift+Tab would leave the dialog; it wraps round to the last control instead. */
function wrapShiftTabFromPanel(event: KeyboardEvent<HTMLDivElement>) {
  if (event.key !== "Tab" || !event.shiftKey || event.target !== event.currentTarget) return;
  const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(TABBABLE)).reverse();
  // The last control that can actually take focus: hidden ones refuse it.
  for (const control of controls) {
    control.focus();
    if (document.activeElement === control) {
      event.preventDefault();
      return;
    }
  }
}

interface DialogLayerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  placement: DialogPlacement;
  /** False keeps Esc and scrim clicks from closing it; the content's own buttons must. */
  dismissible?: boolean;
  /** Bottom sheets: a grab handle that can be swiped down to close. */
  handle?: boolean;
  style?: CSSProperties;
  /** Must include a `DialogPrimitive.Title`, which names the dialog for screen readers. */
  children: ReactNode;
}

/**
 * The machinery shared by Modal and Sheet. Radix Dialog supplies the focus trap, Esc, outside clicks, scroll
 * locking and aria wiring; Motion animates the scrim and the panel in and out. Radix is force-mounted inside
 * `AnimatePresence`, so the panel stays mounted until its exit animation has finished. A dialog that opens
 * without the learner's doing starts with focus on its panel rather than on a button.
 */
export function DialogLayer({ open, onOpenChange, placement, dismissible = true, handle = false, style, children }: DialogLayerProps) {
  const dragControls = useDragControls();
  const fade = useFadeSeconds();
  const swipeable = placement === "bottom" && handle && dismissible;
  const keepOpen = dismissible ? undefined : (event: Event) => event.preventDefault();

  function handleDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.y > SWIPE_CLOSE_DISTANCE_PX || info.velocity.y > SWIPE_CLOSE_VELOCITY) onOpenChange(false);
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <DialogPrimitive.Portal forceMount>
            <DialogPrimitive.Overlay forceMount asChild>
              <motion.div
                {...scrimMotion(fade)}
                className={cn(
                  "fixed inset-x-0 bottom-0 z-(--z-overlay) bg-(--c-scrim)",
                  placement === "top" ? "top-(--topbar-h)" : "top-0",
                )}
              />
            </DialogPrimitive.Overlay>
            <div className={cn("pointer-events-none fixed inset-x-0 bottom-0 z-(--z-modal) flex justify-center", FRAME_CLASSES[placement])}>
              <DialogPrimitive.Content forceMount asChild onEscapeKeyDown={keepOpen} onPointerDownOutside={keepOpen}>
                <motion.div
                  ref={focusPanelIfUnasked}
                  onKeyDown={wrapShiftTabFromPanel}
                  {...panelMotion(placement, fade)}
                  drag={swipeable ? "y" : false}
                  dragListener={false}
                  dragControls={dragControls}
                  dragConstraints={{ top: 0, bottom: 0 }}
                  dragElastic={{ top: 0, bottom: 0.6 }}
                  onDragEnd={handleDragEnd}
                  className={cn(
                    "pointer-events-auto relative overflow-y-auto bg-page text-fg outline-none",
                    PANEL_CLASSES[placement],
                  )}
                  style={style}
                >
                  {swipeable && (
                    <div
                      aria-hidden="true"
                      onPointerDown={(event) => dragControls.start(event)}
                      className="absolute inset-x-0 top-0 flex h-6 cursor-grab touch-none items-center justify-center active:cursor-grabbing"
                    >
                      <span className="h-1 w-10 rounded-[2px] bg-line" />
                    </div>
                  )}
                  {children}
                </motion.div>
              </DialogPrimitive.Content>
            </div>
          </DialogPrimitive.Portal>
        )}
      </AnimatePresence>
    </DialogPrimitive.Root>
  );
}
