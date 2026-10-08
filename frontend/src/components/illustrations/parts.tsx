import { useId, type ReactNode } from "react";
import { ART } from "./palette";

/** Props every illustration accepts. */
export interface IllustrationProps {
  /** Width and height in px. Leave it out to size the drawing with CSS (it fills its box by default). */
  size?: number;
  className?: string;
  /** Accessible name. Without one the drawing is decorative and hidden from assistive technology. */
  title?: string;
}

/** The square 120-unit artboard shared by every picture-card illustration. */
export function ArtSvg({ size, className, title, children }: IllustrationProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 120 120"
      width={size ?? "100%"}
      height={size ?? "100%"}
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

interface TwoToneProps {
  d: string;
  fill: string;
  shade: string;
  /** How far the lit copy moves up-left, which sets the width of the shaded crescent. */
  offset?: readonly [number, number];
}

/**
 * A shape in its base colour with a darker crescent along its lower-right edge: the brand's two-tone rule.
 * Inside a clip of the shape, the shade fills everything and a copy in the base colour, nudged up and to the
 * left, covers all but the far edge, so the crescent follows any outline.
 */
export function TwoTone({ d, fill, shade, offset = [6, 4] }: TwoToneProps) {
  const clipId = useId();
  return (
    <>
      <clipPath id={clipId}>
        <path d={d} />
      </clipPath>
      <g clipPath={`url(#${clipId})`}>
        <path d={d} fill={shade} />
        <path d={d} fill={fill} transform={`translate(${-offset[0]} ${-offset[1]})`} />
      </g>
    </>
  );
}

/** Draws its children only inside the shape `d`, e.g. a landscape inside a round badge. */
export function Clipped({ d, children }: { d: string; children: ReactNode }) {
  const clipId = useId();
  return (
    <>
      <clipPath id={clipId}>
        <path d={d} />
      </clipPath>
      <g clipPath={`url(#${clipId})`}>{children}</g>
    </>
  );
}

interface HighlightProps {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Degrees, clockwise. */
  rotate?: number;
}

/** The single top-left highlight each drawing carries: a white pill at 45 % opacity. */
export function Highlight({ x, y, width, height, rotate = 0 }: HighlightProps) {
  const radius = Math.min(width, height) / 2;
  return (
    <rect
      x={x}
      y={y}
      width={width}
      height={height}
      rx={radius}
      fill={ART.white}
      fillOpacity={0.45}
      transform={rotate ? `rotate(${rotate} ${x + width / 2} ${y + height / 2})` : undefined}
    />
  );
}

/**
 * The flat pill shadow an object stands on (never an oval). It darkens whatever card it sits on, so it uses a
 * translucent black: 8 % on light surfaces and 25 % on dark ones.
 */
export function GroundShadow({ cx, y, width, height = 8 }: { cx: number; y: number; width: number; height?: number }) {
  return (
    <rect
      x={cx - width / 2}
      y={y}
      width={width}
      height={height}
      rx={height / 2}
      className="fill-[rgb(0_0_0/.08)] dark:fill-[rgb(0_0_0/.25)]"
    />
  );
}

/** A geometric dot eye with a glint, the eye style of the human cast. */
export function DotEye({ cx, cy, r = 4 }: { cx: number; cy: number; r?: number }) {
  return (
    <>
      <circle cx={cx} cy={cy} r={r} fill={ART.eel} />
      <circle cx={cx - r * 0.35} cy={cy - r * 0.4} r={r * 0.36} fill={ART.white} />
    </>
  );
}
