import { useEffect, useRef, type RefObject } from "react";
import { findNodeElement, preferredScrollBehavior, scrollToNode } from "./pathScroll";

/**
 * Scrolls to the node to show, once, when the path first renders: instantly on a normal visit, smoothly when
 * returning from a lesson (where the node just completed or unlocked is the one to show).
 */
export function useInitialScroll(container: RefObject<HTMLElement | null>, nodeId: number | null, smooth: boolean): void {
  const done = useRef(false);
  useEffect(() => {
    if (done.current || nodeId === null || !container.current) return;
    const node = findNodeElement(container.current, nodeId);
    if (!node) return;
    done.current = true;
    scrollToNode(node, preferredScrollBehavior(smooth));
  }, [container, nodeId, smooth]);
}
