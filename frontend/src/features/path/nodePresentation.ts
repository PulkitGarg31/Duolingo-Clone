import type { NodeState, PathNodeOut } from "@/lib/api/types";

/** The white (or grey, when locked) picture on a node's face. */
export type NodeGlyphKind = "star" | "check" | "lock" | "trophy";

/** A review keeps its trophy in every state; a skill shows where the learner stands. */
export function nodeGlyph(node: PathNodeOut): NodeGlyphKind {
  if (node.kind === "review") return "trophy";
  switch (node.state) {
    case "locked":
      return "lock";
    case "completed":
      return "check";
    default:
      return "star";
  }
}

const STATE_WORDS: Record<NodeState, string> = {
  locked: "locked",
  active: "current",
  available: "available",
  completed: "completed",
  legendary: "legendary",
};

/** What a screen reader hears for a node: "Lesson 2 of 3, Introduce yourself, current". */
export function nodeAriaLabel(node: PathNodeOut): string {
  if (node.kind === "chest") {
    if (node.state === "available") return "Open chest";
    return node.state === "locked" ? "Chest, locked" : "Chest, opened";
  }
  const parts = [node.title, STATE_WORDS[node.state]];
  if (node.kind === "skill" && node.state === "active") {
    const lessonNumber = node.nextLessonNumber ?? node.lessonsCompleted + 1;
    parts.unshift(`Lesson ${lessonNumber} of ${node.lessonCount}`);
  }
  return parts.join(", ");
}

/**
 * The node of a unit that shows a bubble above it, as an index into `nodes`: the current node (START) or, in a
 * unit without one, a chest waiting to be opened (OPEN). One call to action at a time: two bubbles would cover
 * the nodes above them. Null when the unit has nothing to play.
 */
export function bubbleNodeIndex(nodes: readonly PathNodeOut[]): number | null {
  const active = nodes.findIndex((node) => node.state === "active");
  if (active !== -1) return active;
  const chest = nodes.findIndex((node) => node.kind === "chest" && node.state === "available");
  return chest === -1 ? null : chest;
}

/** The active node's ring: the share of the skill's lessons already completed. */
export function nodeRingProgress(node: PathNodeOut): number {
  return node.lessonCount > 0 ? node.lessonsCompleted / node.lessonCount : 0;
}
