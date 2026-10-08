import { useEffect, useState, type RefObject } from "react";
import { findNodeElement } from "./pathScroll";

/** The window's edges hidden by the sticky banner and the phone's tab bar, which do not count as "in view". */
const COVERED_MARGIN = "-140px 0px -90px 0px";
/** A node tucked more than halfway under the banner or the tab bar counts as out of view. */
const VISIBLE_SHARE = 0.5;

/**
 * Whether a node has scrolled out of view, and which way it went: "up" when it is above the window, "down"
 * below it, null while it is visible (or when there is no such node).
 */
export function useNodeOffscreen(container: RefObject<HTMLElement | null>, nodeId: number | null): "up" | "down" | null {
  const [direction, setDirection] = useState<"up" | "down" | null>(null);

  useEffect(() => {
    const node = nodeId === null || !container.current ? null : findNodeElement(container.current, nodeId);
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.intersectionRatio >= VISIBLE_SHARE) setDirection(null);
        else setDirection(entry.boundingClientRect.top < (entry.rootBounds?.top ?? 0) ? "up" : "down");
      },
      { rootMargin: COVERED_MARGIN, threshold: VISIBLE_SHARE },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [container, nodeId]);

  return nodeId === null ? null : direction;
}
