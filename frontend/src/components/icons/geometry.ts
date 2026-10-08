/**
 * Small geometry helpers for the icon artwork. Shapes such as stars, hexagons and gems are described by their
 * parameters (centre, radius, corner softness) instead of hand-typed coordinates. Fixed shapes build their path
 * strings once, when the icon module loads.
 */

export type Point = readonly [x: number, y: number];

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

/** Two decimals are plenty for artwork drawn on a 24–64 unit grid. */
const format = (n: number) => String(Math.round(n * 100) / 100);
const formatPoint = ([x, y]: Point) => `${format(x)} ${format(y)}`;

/** Corners of a regular polygon on a circle, starting at `startDeg` (−90 is straight up) and going clockwise. */
export function regularPolygon(cx: number, cy: number, radius: number, sides: number, startDeg = -90): Point[] {
  return Array.from({ length: sides }, (_, i) => {
    const angle = toRadians(startDeg + (360 / sides) * i);
    return [cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)] as const;
  });
}

/** A star's outline: `points` tips on the outer radius alternating with notches on the inner one, first tip up. */
export function starPoints(cx: number, cy: number, outer: number, inner: number, points = 5): Point[] {
  return Array.from({ length: points * 2 }, (_, i) => {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = toRadians(-90 + (180 / points) * i);
    return [cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)] as const;
  });
}

/**
 * A closed path through `points` with soft corners: each corner is cut back `cut` units along both of its edges
 * and the gap is bridged with a quadratic curve that uses the corner itself as the control point. `cut` is one
 * value for every corner, or a list that repeats round the corners (`[tip, notch]` for a star). A cut never
 * goes past the middle of an edge, so neighbouring curves cannot overlap.
 */
export function roundedPolygon(points: readonly Point[], cut: number | readonly number[]): string {
  const corners = points.map((corner, i) => {
    const previous = points[(i - 1 + points.length) % points.length];
    const next = points[(i + 1) % points.length];
    const wanted = typeof cut === "number" ? cut : cut[i % cut.length];
    const distance = Math.min(wanted, length(corner, previous) / 2, length(corner, next) / 2);
    return { corner, enter: towards(corner, previous, distance), leave: towards(corner, next, distance) };
  });
  const [first, ...rest] = corners;
  const curve = ({ corner, enter, leave }: (typeof corners)[number]) =>
    `L${formatPoint(enter)}Q${formatPoint(corner)} ${formatPoint(leave)}`;
  return `M${formatPoint(first.leave)}${rest.map(curve).join("")}${curve(first)}Z`;
}

/** A closed path through `points` with straight edges and sharp corners. */
export function polygonPath(points: readonly Point[]): string {
  return `M${points.map(formatPoint).join("L")}Z`;
}

/** `count` straight spokes from radius `inner` to radius `outer`, the first at `startDeg`: gear teeth, sun rays. */
export function raysPath(cx: number, cy: number, inner: number, outer: number, count: number, startDeg = -90): string {
  const starts = regularPolygon(cx, cy, inner, count, startDeg);
  const ends = regularPolygon(cx, cy, outer, count, startDeg);
  return starts.map((start, i) => `M${formatPoint(start)}L${formatPoint(ends[i])}`).join("");
}

/** An open circular arc drawn clockwise from `startDeg` to `endDeg` (0 points right, 90 down): sound waves, arrows. */
export function arcPath(cx: number, cy: number, radius: number, startDeg: number, endDeg: number): string {
  const [start, end] = [startDeg, endDeg].map(
    (degrees) => [cx + radius * Math.cos(toRadians(degrees)), cy + radius * Math.sin(toRadians(degrees))] as const,
  );
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return `M${formatPoint(start)}A${format(radius)} ${format(radius)} 0 ${largeArc} 1 ${formatPoint(end)}`;
}

/**
 * A shield filling the box (x, y, width, height): flat top with rounded corners, straight sides, and a round
 * bottom 60% as deep as the shield is wide (two cubic quarter-ellipses meeting flat at the bottom centre).
 */
export function shieldPath(x: number, y: number, width: number, height: number, corner: number): string {
  const right = x + width;
  const bottom = y + height;
  const centre = x + width / 2;
  const sideEnd = bottom - width * 0.6;
  // 0.55 places the control points so that each cubic closely follows a quarter ellipse.
  const sideControl = sideEnd + 0.55 * (bottom - sideEnd);
  const reach = 0.55 * (width / 2);
  const n = format;
  return (
    `M${n(x + corner)} ${n(y)}H${n(right - corner)}A${n(corner)} ${n(corner)} 0 0 1 ${n(right)} ${n(y + corner)}` +
    `V${n(sideEnd)}C${n(right)} ${n(sideControl)} ${n(centre + reach)} ${n(bottom)} ${n(centre)} ${n(bottom)}` +
    `C${n(centre - reach)} ${n(bottom)} ${n(x)} ${n(sideControl)} ${n(x)} ${n(sideEnd)}` +
    `V${n(y + corner)}A${n(corner)} ${n(corner)} 0 0 1 ${n(x + corner)} ${n(y)}Z`
  );
}

function length([ax, ay]: Point, [bx, by]: Point): number {
  return Math.hypot(bx - ax, by - ay);
}

/** The point `distance` units from `from` on the way to `to`. */
function towards(from: Point, to: Point, distance: number): Point {
  const total = length(from, to);
  if (total === 0) return from;
  return [from[0] + ((to[0] - from[0]) / total) * distance, from[1] + ((to[1] - from[1]) / total) * distance];
}
