"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createRevealWatch } from "./contentReveal";

const FADE_IN: Keyframe[] = [{ opacity: 0 }, { opacity: 1 }];
const FADE_TIMING: KeyframeAnimationOptions = { duration: 150, easing: "ease-out" };

/**
 * Holds the page inside the app frame. When the page's content replaces its loading skeleton it fades in over
 * 150 ms instead of popping in; a page drawn straight from the cache appears at once, and nothing fades when
 * motion is reduced. Every page shows its skeleton as a `SkeletonGroup`, which puts a role="status" element
 * first, and the swap replaces that element.
 */
export function ContentFadeIn({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const revealed = createRevealWatch(showsSkeleton(root));
    const observer = new MutationObserver(() => {
      if (revealed(showsSkeleton(root)) && !motionReduced()) root.animate(FADE_IN, FADE_TIMING);
    });
    observer.observe(root, { childList: true });
    return () => observer.disconnect();
  }, []);

  return <div ref={ref}>{children}</div>;
}

function showsSkeleton(root: HTMLElement): boolean {
  return root.firstElementChild?.getAttribute("role") === "status";
}

/** The same switch the CSS and the other scripted effects follow (Settings → Animations, or the OS). */
function motionReduced(): boolean {
  return document.documentElement.dataset.motion === "reduced";
}
