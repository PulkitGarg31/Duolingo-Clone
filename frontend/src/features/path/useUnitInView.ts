import { useEffect, useState, type RefObject } from "react";

/** A unit whose nodes show less than this far below the banner counts as scrolled past. */
const SLIVER_PX = 24;

/**
 * The unit the sticky banner should name: the first unit whose nodes (its `data-unit-id` list) still show below
 * the banner's bottom edge. An IntersectionObserver whose root starts at that edge reports it, so nothing runs
 * on scroll; the edge is measured again when the window resizes (the banner sticks lower on tablets and phones).
 */
export function useUnitInView(
  container: RefObject<HTMLElement | null>,
  banner: RefObject<HTMLElement | null>,
  initialUnitId: number,
): number {
  const [unitId, setUnitId] = useState(initialUnitId);

  useEffect(() => {
    const root = container.current;
    const header = banner.current;
    if (!root || !header) return;
    const lists = Array.from(root.querySelectorAll<HTMLElement>("[data-unit-id]"));
    const visible = new Set<Element>();
    let observer: IntersectionObserver | undefined;

    const observe = () => {
      observer?.disconnect();
      visible.clear();
      const edge = Math.round(header.getBoundingClientRect().bottom) + SLIVER_PX;
      const next = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) visible.add(entry.target);
            else visible.delete(entry.target);
          }
          const first = lists.find((list) => visible.has(list));
          if (first) setUnitId(Number(first.dataset.unitId));
        },
        { rootMargin: `-${edge}px 0px 0px 0px` },
      );
      lists.forEach((list) => next.observe(list));
      observer = next;
    };

    observe();
    window.addEventListener("resize", observe);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", observe);
    };
  }, [container, banner]);

  return unitId;
}
