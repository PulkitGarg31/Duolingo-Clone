import type { ReactNode } from "react";
import type { Frame } from "@/components/illustrations/people";

/** Props shared by the people who speak in prompt bubbles. */
export interface CastMemberProps {
  /** Height in px; the width follows the 5 : 6 artboard. */
  size?: number;
  /** Opens and closes the mouth every 150 ms, for while speech plays. */
  talking?: boolean;
  className?: string;
  /** Accessible name. Without one the person is decorative and hidden from assistive technology. */
  title?: string;
}

/** The 100 × 120 artboard of a cast member, standing on its bottom edge (the first answer line). */
export function CastSvg({ size = 120, className, title, children }: Omit<CastMemberProps, "talking"> & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 100 120"
      width={(size * 100) / 120}
      height={size}
      className={className}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      {title && <title>{title}</title>}
      {children}
    </svg>
  );
}

/** Speaker framings on the 100 × 120 artboard, standing on its bottom edge. */
export const CAST_FRAME = {
  adult: { head: { cx: 50, cy: 46, r: 21 }, body: { cx: 50, top: 74, bottom: 120, topHalfWidth: 23, bottomHalfWidth: 36 } },
  child: { head: { cx: 50, cy: 52, r: 22 }, body: { cx: 50, top: 82, bottom: 120, topHalfWidth: 19, bottomHalfWidth: 28 } },
} as const satisfies Record<string, Frame>;
