"use client";

import { useEffect } from "react";
import { useValueChange } from "@/features/shell/useValueChange";
import type { NodeState, PathNodeOut, UnitColor } from "@/lib/api/types";
import { CrownBadge } from "./CrownBadge";
import { LegendarySparkles } from "./LegendarySparkles";
import { NodeFace, type NodeFaceTone } from "./NodeFace";
import { NodeGlyph, type GlyphEntrance } from "./NodeGlyph";
import { NodePopover } from "./NodePopover";
import type { NodeActionKind } from "./nodePopoverModel";
import { nodeAriaLabel, nodeGlyph, nodeRingProgress } from "./nodePresentation";
import { NodeRing } from "./NodeRing";
import { NodeShine } from "./NodeShine";
import { StartBubble } from "./StartBubble";

export interface PathNodeProps {
  node: PathNodeOut;
  unitColor: UnitColor;
  gems: number;
  popoverSide: "top" | "bottom";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pendingKind: NodeActionKind | null;
  onAction: (node: PathNodeOut, kind: NodeActionKind) => void;
  /** Hides the START bubble, as while any node popover is open: the bubble would peek out from under it. */
  hideBubble?: boolean;
}

const FACE_TONES: Record<NodeState, NodeFaceTone> = {
  locked: "locked",
  active: "unit",
  available: "unit",
  completed: "unit",
  legendary: "gold",
};

/** The longest state-change animation (the crown's flight) ends by then. */
const CHOREOGRAPHY_MS = 1_200;

/**
 * A skill or unit review on the path. Its visuals follow `node.state`; when the state changes while the path is
 * on screen (returning from a lesson), the change plays out: the ring fills, the star turns into a check and a
 * crown flies in, or a locked node takes the unit colour, its glyph grows and its START bubble pops up.
 */
export function PathNode({ node, unitColor, gems, popoverSide, open, onOpenChange, pendingKind, onAction, hideBubble = false }: PathNodeProps) {
  const change = useValueChange(node.state);
  const { previous, settle } = change;
  const done = node.state === "completed" || node.state === "legendary";
  const completing = previous === "active" && done;
  const unlocking = previous === "locked" && node.state === "active";
  const promoted = previous === "completed" && node.state === "legendary";

  useEffect(() => {
    if (previous === null) return;
    const timer = setTimeout(settle, CHOREOGRAPHY_MS);
    return () => clearTimeout(timer);
  }, [previous, settle]);

  const glyph = nodeGlyph(node);
  const previousGlyph = previous === null ? glyph : nodeGlyph({ ...node, state: previous });
  const glyphChanged = previousGlyph !== glyph;
  const entrance: GlyphEntrance | null = !glyphChanged ? null : completing ? "complete" : "unlock";

  return (
    <div className="relative h-[65px] w-[70px]" data-node-id={node.id}>
      {(node.state === "active" || completing) && (
        <NodeRing progress={completing ? 1 : nodeRingProgress(node)} fadeOut={completing} />
      )}
      {node.state === "active" && !open && !hideBubble && <StartBubble label="Start" pop={unlocking} />}
      {node.state === "legendary" && <LegendarySparkles />}
      <NodePopover
        node={node}
        unitColor={unitColor}
        gems={gems}
        open={open}
        onOpenChange={onOpenChange}
        side={popoverSide}
        pendingKind={pendingKind}
        onAction={(kind) => onAction(node, kind)}
      >
        <NodeFace tone={FACE_TONES[node.state]} aria-label={nodeAriaLabel(node)}>
          <NodeGlyph glyph={glyph} leaving={entrance === "complete" ? previousGlyph : null} entrance={entrance} />
          {done && <NodeShine appear={completing || promoted} />}
          {node.crownLevel > 0 && (
            <CrownBadge
              // A new state remounts the crown, so a promotion to Legendary flies the gold crown in again.
              key={node.state}
              level={node.crownLevel}
              legendary={node.state === "legendary"}
              flyIn={completing || promoted}
            />
          )}
        </NodeFace>
      </NodePopover>
    </div>
  );
}
