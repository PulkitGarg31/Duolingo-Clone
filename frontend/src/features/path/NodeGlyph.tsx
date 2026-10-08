import type { ComponentType } from "react";
import { CheckGlyph, LockGlyph, StarGlyph, TrophyGlyph, type IconProps } from "@/components/icons";
import { cn } from "@/lib/cn";
import type { NodeGlyphKind } from "./nodePresentation";

const GLYPHS: Record<NodeGlyphKind, { Icon: ComponentType<IconProps>; size: number }> = {
  star: { Icon: StarGlyph, size: 30 },
  check: { Icon: CheckGlyph, size: 30 },
  lock: { Icon: LockGlyph, size: 26 },
  trophy: { Icon: TrophyGlyph, size: 30 },
};

/**
 * How a new glyph arrives after a state change:
 * - `complete`: the old glyph shrinks once the ring has filled (300 ms), then the new one grows past full size;
 * - `unlock`: the new glyph grows in while the face fades from grey to its new colour.
 */
export type GlyphEntrance = "complete" | "unlock";

const ENTRANCE_CLASSES: Record<GlyphEntrance, string> = {
  complete: "animate-[grow-in_300ms_ease-out_600ms_both]",
  unlock: "animate-[grow-in_600ms_ease-in-out_both]",
};

interface NodeGlyphProps {
  glyph: NodeGlyphKind;
  /** The glyph being replaced while a `complete` entrance plays. */
  leaving?: NodeGlyphKind | null;
  entrance?: GlyphEntrance | null;
}

/** The picture on a node's face. Both glyphs share one grid cell while one replaces the other. */
export function NodeGlyph({ glyph, leaving = null, entrance = null }: NodeGlyphProps) {
  return (
    <span className="grid place-items-center">
      {leaving && (
        <GlyphArt key={`leaving-${leaving}`} kind={leaving} className="animate-[shrink-out_300ms_ease-in_300ms_forwards]" />
      )}
      <GlyphArt key={glyph} kind={glyph} className={entrance ? ENTRANCE_CLASSES[entrance] : undefined} />
    </span>
  );
}

function GlyphArt({ kind, className }: { kind: NodeGlyphKind; className?: string }) {
  const { Icon, size } = GLYPHS[kind];
  return (
    <span className={cn("col-start-1 row-start-1 grid place-items-center", className)}>
      <Icon size={size} />
    </span>
  );
}
