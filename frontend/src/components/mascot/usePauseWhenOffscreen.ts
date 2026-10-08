import { useEffect, type RefObject } from "react";

/**
 * Marks the element `data-offscreen` while it is scrolled out of view, so CSS can pause its looping
 * animations (`[data-offscreen] * { animation-play-state: paused }`). The attribute is written directly, so
 * scrolling never re-renders the component.
 */
export function usePauseWhenOffscreen(ref: RefObject<Element | null>): void {
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => {
      element.toggleAttribute("data-offscreen", !entry.isIntersecting);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
}
