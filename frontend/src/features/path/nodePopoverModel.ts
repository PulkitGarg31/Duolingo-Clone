import type { PathNodeOut } from "@/lib/api/types";

/** What a popover button starts. */
export type NodeActionKind = "lesson" | "practice" | "legendary";

/** A session being started from a node's popover, while the request is in flight. */
export interface PendingNodeAction {
  nodeId: number;
  kind: NodeActionKind;
}

export interface NodeActionModel {
  kind: NodeActionKind;
  /** Sentence case; buttons uppercase their labels. */
  label: string;
  variant: "white" | "gold";
  disabled: boolean;
  /** A line under the button, e.g. "Uses 100 gems". */
  caption: string | null;
}

/**
 * - `unit`: the unit colour (active and completed nodes).
 * - `legendary`: gold with dark gold text.
 * - `locked`: the grey surface, with a LOCKED button.
 * - `muted`: the grey surface without buttons, for a node that cannot be played right now.
 */
export type NodePopoverTone = "unit" | "legendary" | "locked" | "muted";

export interface NodePopoverModel {
  tone: NodePopoverTone;
  title: string;
  subtitle: string;
  actions: NodeActionModel[];
  /** Shows the disabled LOCKED button. */
  locked: boolean;
}

const LOCKED_HINT = "Complete all levels above to unlock this!";
const COMPLETED_LINE = "You completed this level!";

/**
 * The node popover's content, read only from the node's state and its server-computed `actions`: the client
 * never re-derives unlock rules. `gems` decides whether the Legendary fee can be paid.
 */
export function nodePopoverModel(node: PathNodeOut, gems: number): NodePopoverModel {
  const { actions } = node;

  if (node.state === "locked") {
    const title = node.kind === "chest" ? "Treasure chest" : node.title;
    return { tone: "locked", title, subtitle: LOCKED_HINT, actions: [], locked: true };
  }

  if (node.state === "active") {
    if (!actions.canStart) {
      return { tone: "muted", title: node.title, subtitle: "This lesson is currently unavailable", actions: [], locked: false };
    }
    const lessonNumber = node.nextLessonNumber ?? node.lessonsCompleted + 1;
    const subtitle =
      node.kind === "review" ? "Test what you've learned in this unit" : `Lesson ${lessonNumber} of ${node.lessonCount}`;
    const start = whiteAction("lesson", `Start +${actions.startXp ?? 0} XP`);
    return { tone: "unit", title: node.title, subtitle, actions: [start], locked: false };
  }

  const practice = actions.canPractice ? [whiteAction("practice", `Practice +${actions.practiceXp} XP`)] : [];

  if (node.state === "legendary") {
    return { tone: "legendary", title: node.title, subtitle: COMPLETED_LINE, actions: practice, locked: false };
  }

  if (!actions.canLegendary) {
    return { tone: "unit", title: node.title, subtitle: COMPLETED_LINE, actions: practice, locked: false };
  }

  const affordable = gems >= actions.legendaryPriceGems;
  const legendary: NodeActionModel = {
    kind: "legendary",
    label: `Legendary +${actions.legendaryXp} XP`,
    variant: "gold",
    disabled: !affordable,
    caption: affordable ? `Uses ${actions.legendaryPriceGems} gems` : "Not enough gems",
  };
  return {
    tone: "unit",
    title: node.title,
    subtitle: "Prove your proficiency with Legendary",
    actions: [...practice, legendary],
    locked: false,
  };
}

function whiteAction(kind: NodeActionKind, label: string): NodeActionModel {
  return { kind, label, variant: "white", disabled: false, caption: null };
}
