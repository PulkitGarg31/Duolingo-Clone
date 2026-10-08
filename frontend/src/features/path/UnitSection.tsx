"use client";

import { useId } from "react";
import type { PathNodeOut, PathUnitOut } from "@/lib/api/types";
import { ChestNode } from "./ChestNode";
import { PathDecor } from "./PathDecor";
import { decorAnchors, unitNodeLayout } from "./pathLayout";
import { PathNode } from "./PathNode";
import type { NodeActionKind, PendingNodeAction } from "./nodePopoverModel";
import { bubbleNodeIndex } from "./nodePresentation";
import { unitColorVariables } from "./unitColors";
import { UnitDivider } from "./UnitDivider";

export interface UnitSectionProps {
  unit: PathUnitOut;
  unitIndex: number;
  gems: number;
  openNodeId: number | null;
  onOpenNodeChange: (nodeId: number | null) => void;
  pending: PendingNodeAction | null;
  onAction: (node: PathNodeOut, kind: NodeActionKind) => void;
  onClaimChest: (node: PathNodeOut) => void;
}

/**
 * One unit of the path: a divider with its title (the first unit's title is in the banner), its nodes in a
 * zig-zag ordered list, and the owl decorations beside them. The unit's colours are set here as variables.
 */
export function UnitSection({ unit, unitIndex, gems, openNodeId, onOpenNodeChange, pending, onAction, onClaimChest }: UnitSectionProps) {
  const headingId = useId();
  const bubbleIndex = bubbleNodeIndex(unit.nodes);
  const placements = unitNodeLayout(unit.nodes.length, unitIndex, bubbleIndex);
  const decorations = decorAnchors(unit.nodes.length, unitIndex);

  return (
    <section aria-labelledby={headingId} style={unitColorVariables(unit.color)} className="pb-6">
      {unitIndex === 0 ? (
        <h2 id={headingId} className="sr-only">
          {unit.title}
        </h2>
      ) : (
        <UnitDivider id={headingId} title={unit.title} />
      )}
      <ol data-unit-id={unit.id} className="flex flex-col items-center">
        {unit.nodes.map((node, index) => {
          const { x, marginTop } = placements[index];
          const shared = {
            node,
            unitColor: unit.color,
            gems,
            // The last two nodes open their popover upwards, away from the next unit.
            popoverSide: index >= unit.nodes.length - 2 ? ("top" as const) : ("bottom" as const),
            open: openNodeId === node.id,
            onOpenChange: (open: boolean) => onOpenNodeChange(open ? node.id : null),
          };
          return (
            <li key={node.id} className="relative" style={{ left: x, marginTop }}>
              {/* An open popover hides the bubble, which would otherwise peek out from under it. */}
              {node.kind === "chest" ? (
                <ChestNode {...shared} showBubble={index === bubbleIndex && openNodeId === null} onClaim={onClaimChest} />
              ) : (
                <PathNode
                  {...shared}
                  pendingKind={pending?.nodeId === node.id ? pending.kind : null}
                  onAction={onAction}
                  hideBubble={openNodeId !== null}
                />
              )}
              {decorations.map(
                (anchor, order) =>
                  anchor.nodeIndex === index && (
                    <PathDecor
                      key={order}
                      side={anchor.side}
                      unitIndex={unitIndex}
                      second={order > 0}
                      nodeX={x}
                      faded={unit.state === "locked"}
                    />
                  ),
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
