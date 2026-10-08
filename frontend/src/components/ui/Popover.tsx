"use client";

import * as PopoverPrimitive from "@radix-ui/react-popover";
import { AnimatePresence, motion } from "motion/react";
import { createContext, useContext, useState, type CSSProperties, type PointerEventHandler, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { EASE_OUT, useFadeSeconds } from "./transitions";

/** The arrow is 24 × 12 and tucks 2 px into the popover, over its border, so the two read as one shape. */
const ARROW_WIDTH = 24;
const ARROW_HEIGHT = 12;

const OpenContext = createContext(false);

interface PopoverProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Traps focus inside while open, for popovers whose content is the next step (the path's node popover). */
  modal?: boolean;
  children: ReactNode;
}

/**
 * A floating panel anchored to its trigger: `<Popover><PopoverTrigger asChild>…</PopoverTrigger>
 * <PopoverContent>…</PopoverContent></Popover>`. Radix handles positioning, collisions, Esc, outside clicks
 * and focus; the look and the motion are ours. Works controlled (`open` + `onOpenChange`) or uncontrolled.
 */
export function Popover({ open: openProp, defaultOpen = false, onOpenChange, modal = false, children }: PopoverProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const open = openProp ?? uncontrolledOpen;

  function setOpen(next: boolean) {
    if (openProp === undefined) setUncontrolledOpen(next);
    onOpenChange?.(next);
  }

  return (
    <OpenContext.Provider value={open}>
      <PopoverPrimitive.Root open={open} onOpenChange={setOpen} modal={modal}>
        {children}
      </PopoverPrimitive.Root>
    </OpenContext.Provider>
  );
}

/** Toggles the popover on click; use `asChild` to make your own button the trigger. */
export const PopoverTrigger = PopoverPrimitive.Trigger;
/** Positions the popover against an element without making it a click trigger (hover-opened popovers). */
export const PopoverAnchor = PopoverPrimitive.Anchor;
/** Closes the popover when clicked. */
export const PopoverClose = PopoverPrimitive.Close;

/**
 * - `default`: page background with a line border.
 * - `subtle`: the grey surface of locked content.
 * - `surface`: a coloured panel without a border, painted with the `--surface` variable (set it through
 *   `style`, e.g. to the unit colour, since the popover renders outside the page tree). Text uses the
 *   on-colour token, or `--surface-ink` when set (a darker shade for light surfaces such as gold).
 */
export type PopoverTone = "default" | "subtle" | "surface";

const TONE_CLASSES: Record<PopoverTone, string> = {
  default: "[--popover-bg:var(--c-bg)] [--popover-line:var(--c-line)] text-fg",
  subtle: "[--popover-bg:var(--c-bg-subtle)] [--popover-line:var(--c-line)] text-fg",
  surface:
    "[--popover-bg:var(--surface,var(--c-primary))] [--popover-line:transparent] text-[color:var(--surface-ink,var(--c-fg-on-color))]",
};

interface PopoverContentProps {
  children: ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  /** Gap in px between the trigger and the popover box. The arrow sits inside it and may touch the trigger. */
  offset?: number;
  /** Width in px; it never exceeds the viewport minus 16 px on each side. */
  width?: number;
  tone?: PopoverTone;
  arrow?: boolean;
  /** Moves focus into the popover when it opens. Pass false when it opens on hover. */
  autoFocus?: boolean;
  /** Padding and layout of the panel; it has none of its own. */
  className?: string;
  style?: CSSProperties;
  "aria-label"?: string;
  onPointerEnter?: PointerEventHandler<HTMLDivElement>;
  onPointerLeave?: PointerEventHandler<HTMLDivElement>;
}

/** The panel: fades in while dropping 4 px into place (150 ms), fades out in 100 ms. */
export function PopoverContent({
  children,
  side = "bottom",
  align = "center",
  offset = 8,
  width,
  tone = "default",
  arrow = true,
  autoFocus = true,
  className,
  style,
  ...rest
}: PopoverContentProps) {
  const open = useContext(OpenContext);
  const fade = useFadeSeconds();
  return (
    <AnimatePresence>
      {open && (
        <PopoverPrimitive.Portal forceMount>
          <PopoverPrimitive.Content
            forceMount
            asChild
            side={side}
            align={align}
            // Radix measures the gap from the arrow's tip, while `offset` is measured from the box.
            sideOffset={arrow ? offset - ARROW_HEIGHT : offset}
            collisionPadding={16}
            // Keeps the arrow clear of the 15 px rounded corners.
            arrowPadding={16}
            onOpenAutoFocus={autoFocus ? undefined : (event) => event.preventDefault()}
          >
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.1 } }}
              transition={{ duration: fade(0.15), ease: EASE_OUT }}
              className={cn(
                "relative z-(--z-popover) max-w-[calc(100vw-32px)] rounded-[15px] border-2 border-(--popover-line) bg-(--popover-bg) outline-none",
                TONE_CLASSES[tone],
                className,
              )}
              style={{ width, ...style }}
              {...rest}
            >
              {children}
              {arrow && (
                <PopoverPrimitive.Arrow asChild width={ARROW_WIDTH} height={ARROW_HEIGHT}>
                  <svg
                    viewBox={`0 0 ${ARROW_WIDTH} ${ARROW_HEIGHT}`}
                    className="block -translate-y-0.5 overflow-visible"
                  >
                    <path d={`M0 0 L${ARROW_WIDTH / 2} ${ARROW_HEIGHT} L${ARROW_WIDTH} 0 Z`} className="fill-(--popover-bg)" />
                    <path
                      d={`M0 0 L${ARROW_WIDTH / 2} ${ARROW_HEIGHT} L${ARROW_WIDTH} 0`}
                      fill="none"
                      strokeWidth={2}
                      className="stroke-(--popover-line)"
                    />
                  </svg>
                </PopoverPrimitive.Arrow>
              )}
            </motion.div>
          </PopoverPrimitive.Content>
        </PopoverPrimitive.Portal>
      )}
    </AnimatePresence>
  );
}
