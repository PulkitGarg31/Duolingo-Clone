import { useEffect, useRef, useState, type MouseEvent, type PointerEvent } from "react";

/** Hovering opens after this pause, so a pointer passing over the item does nothing. */
const OPEN_DELAY_MS = 150;
/** Leaving closes after this pause, so the pointer can travel from the item to the popover. */
const CLOSE_DELAY_MS = 200;

/** "hover" closes again when the pointer leaves; "press" (a click, a tap or a key) stays until dismissed. */
type OpenedBy = "hover" | "press";

export interface HoverPopover {
  open: boolean;
  /** Focus moves into the popover only when it was opened by a press, never by hovering. */
  autoFocus: boolean;
  /** For the popover's `onOpenChange`: Esc and outside clicks close it. */
  setOpen: (open: boolean) => void;
  /** Spread on the trigger (inside `PopoverTrigger asChild`). */
  triggerProps: {
    onClick: (event: MouseEvent) => void;
    onPointerEnter: (event: PointerEvent) => void;
    onPointerLeave: (event: PointerEvent) => void;
  };
  /** Spread on the popover content. */
  contentProps: {
    onPointerEnter: (event: PointerEvent) => void;
    onPointerLeave: (event: PointerEvent) => void;
  };
}

/**
 * A popover that opens on hover with a mouse and on a press everywhere else (the stats and the MORE menu).
 * Pressing a hover-opened popover pins it open; pressing again closes it.
 */
export function useHoverPopover(): HoverPopover {
  const [openedBy, setOpenedBy] = useState<OpenedBy | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  function schedule(run: () => void, delayMs: number) {
    clearTimeout(timer.current);
    timer.current = setTimeout(run, delayMs);
  }

  function hoverOpen(event: PointerEvent) {
    if (event.pointerType !== "mouse") return;
    schedule(() => setOpenedBy((current) => current ?? "hover"), OPEN_DELAY_MS);
  }

  function hoverClose(event: PointerEvent) {
    if (event.pointerType !== "mouse") return;
    schedule(() => setOpenedBy((current) => (current === "hover" ? null : current)), CLOSE_DELAY_MS);
  }

  function keepOpen(event: PointerEvent) {
    if (event.pointerType === "mouse") clearTimeout(timer.current);
  }

  function press(event: MouseEvent) {
    // The trigger would toggle on its own and close a popover that hovering has just opened.
    event.preventDefault();
    clearTimeout(timer.current);
    setOpenedBy((current) => (current === "press" ? null : "press"));
  }

  function setOpen(open: boolean) {
    clearTimeout(timer.current);
    setOpenedBy(open ? "press" : null);
  }

  return {
    open: openedBy !== null,
    autoFocus: openedBy === "press",
    setOpen,
    triggerProps: { onClick: press, onPointerEnter: hoverOpen, onPointerLeave: hoverClose },
    contentProps: { onPointerEnter: keepOpen, onPointerLeave: hoverClose },
  };
}
