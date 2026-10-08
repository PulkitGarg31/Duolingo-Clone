/** Drawing pieces reused by several icons. They render SVG children, never an <svg> of their own. */
import { useId, type ReactNode } from "react";
import { polygonPath, regularPolygon, roundedPolygon, starPoints } from "./geometry";
import { ART, GREY, HIGHLIGHT } from "./palette";
import { HEART } from "./shapes";

interface HeartArtProps {
  fill: string;
  /** The darker shade along the lower-right edge. */
  shade: string;
  highlight?: string;
  highlightOpacity?: number;
}

/**
 * The heart on the 32-unit grid. The shade is the heart itself showing around a copy of it nudged up and to the
 * left, both clipped to the outline, which leaves a crescent along the lower-right edge.
 */
export function HeartArt({ fill, shade, highlight, highlightOpacity = 1 }: HeartArtProps) {
  const clip = useId();
  return (
    <>
      <defs>
        <clipPath id={clip}>
          <path d={HEART} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clip})`}>
        <path d={HEART} fill={shade} />
        <path d={HEART} fill={fill} transform="translate(-1.4 -1.7)" />
      </g>
      {highlight ? (
        <path
          d="M7.1 12.6C7.3 11 8.2 9.8 9.6 9.2"
          fill="none"
          stroke={highlight}
          strokeOpacity={highlightOpacity}
          strokeWidth={2.6}
          strokeLinecap="round"
        />
      ) : null}
    </>
  );
}

export interface GemColors {
  base: string;
  light: string;
  shade: string;
}

/**
 * A gem centred on (cx, cy): a soft pointy-top hexagon with a large light facet across its upper left and its
 * lower-right edge in shade (the same offset-copy trick as the heart), all clipped to the outline.
 */
export function GemShape({ cx, cy, r, colors }: { cx: number; cy: number; r: number; colors: GemColors }) {
  const clip = useId();
  const corners = regularPolygon(cx, cy, r, 6);
  const outline = roundedPolygon(corners, r * 0.24);
  const [top, , , , , upperLeft] = corners;
  const facet = polygonPath([
    upperLeft,
    top,
    [cx + r * 0.38, cy - r * 0.42],
    [cx + r * 0.12, cy - r * 0.05],
    [cx - r * 0.55, cy + r * 0.05],
  ]);
  return (
    <>
      <defs>
        <clipPath id={clip}>
          <path d={outline} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clip})`}>
        <path d={outline} fill={colors.shade} />
        <path d={outline} fill={colors.base} transform={`translate(${-r * 0.08} ${-r * 0.14})`} />
        <path d={facet} fill={colors.light} />
      </g>
    </>
  );
}

/** A four-point sparkle with soft tips, centred on (cx, cy) with tips `r` units out. */
export function Sparkle({ cx, cy, r, color }: { cx: number; cy: number; r: number; color: string }) {
  return <path d={roundedPolygon(starPoints(cx, cy, r, r * 0.34, 4), [r * 0.2, r * 0.12])} fill={color} />;
}

export type ChestVariant = "closed" | "open" | "locked";

const CHEST_COLOURS = {
  wood: { wood: ART.wood, woodLip: ART.woodLip, band: ART.bee, bandLip: ART.camel, keyhole: ART.eel },
  // The keyhole takes the lip grey: hare would vanish against the dark theme's koala latch.
  grey: { wood: GREY.base, woodLip: GREY.lip, band: GREY.mid, bandLip: GREY.lip, keyhole: GREY.lip },
};

const CHEST_LID = "M4 15V11.6C4 7.4 9.4 4.6 16 4.6C22.6 4.6 28 7.4 28 11.6V15Z";
// Thrown back, the lid shows only its dark underside inside a wooden rim; its hinge edge hides behind the body.
const CHEST_LID_OPEN = "M5.4 15 6.8 6.2C7 5 7.9 4.2 9.1 4.2H22.9C24.1 4.2 25 5 25.2 6.2L26.6 15Z";
const CHEST_LID_OPEN_INSIDE = "M7.8 15 8.8 7.6C8.9 7 9.4 6.6 10 6.6H22C22.6 6.6 23.1 7 23.2 7.6L24.2 15Z";
const CHEST_BODY_BOTTOM = "M4 24.6H28V25.6A2.4 2.4 0 0 1 25.6 28H6.4A2.4 2.4 0 0 1 4 25.6Z";

/**
 * A treasure chest seen from the front on the 32-unit grid: wood with two gold bands and a gold latch.
 * `contents` (an open chest's gems) are drawn between the lid and the body.
 */
export function ChestArt({ variant, contents }: { variant: ChestVariant; contents?: ReactNode }) {
  const clip = useId();
  const c = variant === "locked" ? CHEST_COLOURS.grey : CHEST_COLOURS.wood;
  const open = variant === "open";
  const lid = open ? CHEST_LID_OPEN : CHEST_LID;
  return (
    <>
      <defs>
        <clipPath id={clip}>
          <rect x={4} y={14} width={24} height={14} rx={2.4} />
          <path d={lid} />
        </clipPath>
      </defs>
      <path d={lid} fill={c.wood} />
      {open ? <path d={CHEST_LID_OPEN_INSIDE} fill={c.woodLip} /> : null}
      {contents}
      <rect x={4} y={14} width={24} height={14} rx={2.4} fill={c.wood} />
      <path d={CHEST_BODY_BOTTOM} fill={c.woodLip} />
      {/* the seam under the lid, deeper on an open chest where it is the dark inside */}
      <rect x={4} y={14} width={24} height={open ? 3 : 2.2} fill={c.woodLip} />
      {/* the bands run over lid and body, clipped to their outline */}
      <g clipPath={`url(#${clip})`}>
        <rect x={8} width={3.2} height={32} fill={c.band} />
        <rect x={20.8} width={3.2} height={32} fill={c.band} />
        <rect x={8} y={24.6} width={3.2} height={4} fill={c.bandLip} />
        <rect x={20.8} y={24.6} width={3.2} height={4} fill={c.bandLip} />
      </g>
      <g transform={open ? "translate(0 3)" : undefined}>
        <rect x={13} y={12} width={6} height={7.6} rx={1.6} fill={c.band} />
        <path d="M13 17H19V18A1.6 1.6 0 0 1 17.4 19.6H14.6A1.6 1.6 0 0 1 13 18Z" fill={c.bandLip} />
        <circle cx={16} cy={14.8} r={1.3} fill={c.keyhole} />
        <rect x={15.35} y={15.2} width={1.3} height={2.3} rx={0.65} fill={c.keyhole} />
      </g>
      {variant === "closed" ? (
        <path
          d="M7.4 11 9.6 8.4"
          stroke={HIGHLIGHT.color}
          strokeOpacity={HIGHLIGHT.opacity}
          strokeWidth={1.8}
          strokeLinecap="round"
        />
      ) : null}
    </>
  );
}
