import { useEffect, useEffectEvent } from "react";

/** Scrolling this far closes an open node popover, which would otherwise drift away from its node. */
const SCROLL_TOLERANCE_PX = 40;

/** Calls `onClose` once the window has scrolled more than 40 px while `open`. */
export function useCloseOnScroll(open: boolean, onClose: () => void): void {
  const close = useEffectEvent(onClose);
  useEffect(() => {
    if (!open) return;
    const startY = window.scrollY;
    function handleScroll() {
      if (Math.abs(window.scrollY - startY) > SCROLL_TOLERANCE_PX) close();
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [open]);
}
