/*
 * The learning path's zig-zag. Nodes sit in a centred column and are pushed sideways by `left: x`, swinging
 * through one 8-node cycle; the vertical gap keeps every node centre 89 px from the previous one, so the
 * diagonal steps look as even as the straight ones.
 */

/** One swing as fractions of the amplitude: 0 is the far left, 0.5 the centre line, 1 the far right. */
const CYCLE = [0.5, 0.1794, 0, 0.1794, 0.5, 0.8206, 1, 0.8206] as const;
/** Distance between the leftmost and rightmost node centres, in px. */
const AMPLITUDE = 140;
/** Centre-to-centre distance between consecutive nodes, in px. */
const NODE_SPACING = 89;
/** A node's layout slot: the 57 px face plus its 8 px lip. */
export const NODE_SLOT_HEIGHT = 65;
/** Gap between the unit banner (or divider) and a unit's first node. */
const FIRST_NODE_GAP = 24;
/**
 * How far a START (or OPEN) bubble reaches above its node's slot: it floats 20 px over the face, clear of the
 * ring, its box is 44 px tall, and it bobs 6 px higher. Keep in step with `StartBubble`.
 */
export const BUBBLE_REACH = 20 + 44 + 6;
/** Air left between the bubble, at the top of its bob, and the node or banner above it. */
const BUBBLE_AIR = 6;

/** Horizontal offset of a node from the column's centre line, in px. */
export function nodeOffsetX(index: number, unitIndex: number, isLast: boolean): number {
  if (isLast) return 0;
  // Even units swing left first, odd units start half a cycle later and swing right.
  const start = unitIndex % 2 === 0 ? 0 : 4;
  return AMPLITUDE * (CYCLE[(start + index) % CYCLE.length] - 0.5);
}

/**
 * Space above a node, in px, given its offset and the previous node's. May be negative on wide steps. The node
 * carrying the bubble gets the room the bubble needs instead, so the bubble never covers the node above it.
 */
export function nodeMarginTop(previousX: number, x: number, isFirst: boolean, hasBubble: boolean): number {
  const gap = isFirst ? FIRST_NODE_GAP : Math.sqrt(NODE_SPACING ** 2 - (x - previousX) ** 2) - NODE_SLOT_HEIGHT;
  return hasBubble ? Math.max(gap, BUBBLE_REACH + BUBBLE_AIR) : gap;
}

export interface NodePlacement {
  x: number;
  marginTop: number;
}

/** Placement of every node in a unit. `bubbleIndex` is the node showing a bubble (START or OPEN), or null. */
export function unitNodeLayout(count: number, unitIndex: number, bubbleIndex: number | null): NodePlacement[] {
  const placements: NodePlacement[] = [];
  for (let index = 0; index < count; index++) {
    const x = nodeOffsetX(index, unitIndex, index === count - 1);
    const previousX = index === 0 ? 0 : placements[index - 1].x;
    placements.push({ x, marginTop: nodeMarginTop(previousX, x, index === 0, bubbleIndex === index) });
  }
  return placements;
}

export interface DecorAnchor {
  /** The node the decoration is vertically centred on. */
  nodeIndex: number;
  side: "left" | "right";
}

/** The third node is the far end of the first swing, so the mascot sits beside it on the open side. */
const FIRST_DECOR_INDEX = 2;
/** Long units get a second mascot here, on the other side. */
const SECOND_DECOR_INDEX = 6;

/** Where a unit's mascot decorations go: opposite the first swing, and a second one in long units. */
export function decorAnchors(count: number, unitIndex: number): DecorAnchor[] {
  if (count === 0) return [];
  const side = unitIndex % 2 === 0 ? "right" : "left";
  const anchors: DecorAnchor[] = [{ nodeIndex: Math.min(FIRST_DECOR_INDEX, count - 1), side }];
  if (count > SECOND_DECOR_INDEX) {
    anchors.push({ nodeIndex: SECOND_DECOR_INDEX, side: side === "right" ? "left" : "right" });
  }
  return anchors;
}
