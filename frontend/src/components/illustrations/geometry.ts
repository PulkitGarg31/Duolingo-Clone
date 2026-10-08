/* Path-data helpers for the artwork: pure functions, no React. */

/** Path data for a circle, so circles can go wherever a path is expected (clips, two-tone shapes). */
export function circlePath(cx: number, cy: number, r: number): string {
  return `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;
}

type Point = readonly [number, number];

/**
 * Path data for a polygon with every corner rounded (the brand draws no sharp points). `radius` is one value
 * for all corners or one per corner; each is capped at half of the shorter neighbouring edge.
 */
export function roundedPolygon(points: readonly Point[], radius: number | readonly number[]): string {
  const corners = points.map((point, index) => {
    const previous = points[(index - 1 + points.length) % points.length];
    const next = points[(index + 1) % points.length];
    const toPrevious = [previous[0] - point[0], previous[1] - point[1]];
    const toNext = [next[0] - point[0], next[1] - point[1]];
    const previousLength = Math.hypot(toPrevious[0], toPrevious[1]);
    const nextLength = Math.hypot(toNext[0], toNext[1]);
    const r = Math.min(typeof radius === "number" ? radius : radius[index], previousLength / 2, nextLength / 2);
    return {
      point,
      // Where the rounded corner leaves the incoming edge and joins the outgoing one.
      enter: [point[0] + (toPrevious[0] / previousLength) * r, point[1] + (toPrevious[1] / previousLength) * r],
      leave: [point[0] + (toNext[0] / nextLength) * r, point[1] + (toNext[1] / nextLength) * r],
    };
  });
  const round = (value: number) => Math.round(value * 100) / 100;
  const first = corners[0];
  let d = `M${round(first.leave[0])} ${round(first.leave[1])}`;
  for (const corner of [...corners.slice(1), first]) {
    d += `L${round(corner.enter[0])} ${round(corner.enter[1])}`;
    d += `Q${corner.point[0]} ${corner.point[1]} ${round(corner.leave[0])} ${round(corner.leave[1])}`;
  }
  return `${d}Z`;
}
