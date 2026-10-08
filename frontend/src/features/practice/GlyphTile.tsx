import type { ReactNode } from "react";
import type { UnitColor } from "@/lib/api/types";
import { cn } from "@/lib/cn";

/** The path's unit colours plus legendary gold: each has a darker lip, and none changes with the theme. */
export type TileColor = UnitColor | "gold";

const SHAPES = {
  /** A practice card's 64 px picture. */
  tile: { box: "size-16 rounded-[18px]", lip: 4 },
  /** A skill in the Legendary list: a 40 px coin, like a small path node. */
  coin: { box: "size-10 rounded-full", lip: 3 },
} as const;

interface GlyphTileProps {
  color: TileColor;
  shape?: keyof typeof SHAPES;
  /** A one-colour glyph; it is drawn in white. */
  children: ReactNode;
}

/** A bright shape with a solid darker lip and a white glyph on it, in the style of the path's nodes. */
export function GlyphTile({ color, shape = "tile", children }: GlyphTileProps) {
  const { box, lip } = SHAPES[shape];
  return (
    <span
      aria-hidden="true"
      className={cn("grid shrink-0 place-items-center text-on-color-fixed", box)}
      style={{ backgroundColor: `var(--unit-${color})`, boxShadow: `0 ${lip}px 0 var(--unit-${color}-lip)` }}
    >
      {children}
    </span>
  );
}
