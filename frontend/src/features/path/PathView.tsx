"use client";

import { useRef } from "react";
import type { PathNodeOut, PathOut } from "@/lib/api/types";
import { GoToCurrentButton } from "./GoToCurrentButton";
import type { NodeActionKind, PendingNodeAction } from "./nodePopoverModel";
import { findNodeElement, preferredScrollBehavior } from "./pathScroll";
import { UnitBanner } from "./UnitBanner";
import { UnitSection } from "./UnitSection";
import { useCloseOnScroll } from "./useCloseOnScroll";
import { useInitialScroll } from "./useInitialScroll";
import { useNodeOffscreen } from "./useNodeOffscreen";
import { useUnitInView } from "./useUnitInView";

export interface PathViewProps {
  path: PathOut;
  /** The learner's gems, which decide whether Legendary can be paid for. */
  gems: number;
  /** A node to scroll to smoothly (after a lesson); otherwise the path opens on the current node. */
  focusNodeId: number | null;
  /** The node whose popover is open; one at a time. */
  openNodeId: number | null;
  onOpenNodeChange: (nodeId: number | null) => void;
  /** A session start in flight, shown as a loading button. */
  pending: PendingNodeAction | null;
  onAction: (node: PathNodeOut, kind: NodeActionKind) => void;
  onClaimChest: (node: PathNodeOut) => void;
}

/**
 * The learning path: the sticky banner of the unit in view, then every unit's nodes in a zig-zag. It opens on
 * the current node and offers a way back to it once it scrolls away.
 */
export function PathView({ path, gems, focusNodeId, openNodeId, onOpenNodeChange, pending, onAction, onClaimChest }: PathViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bannerRef = useRef<HTMLDivElement>(null);
  const currentNodeId = path.currentNodeId;

  // A focus node from an old link may no longer be on the path; the current node is shown instead.
  const focusOnPath = unitOfNode(path, focusNodeId) !== null;
  const scrollTargetId = focusOnPath ? focusNodeId : currentNodeId;
  const firstUnit = path.units.at(0);
  const initialUnitId = unitOfNode(path, scrollTargetId) ?? firstUnit?.id ?? 0;
  const unitInView = useUnitInView(containerRef, bannerRef, initialUnitId);
  const bannerUnit = path.units.find((unit) => unit.id === unitInView) ?? firstUnit;

  useInitialScroll(containerRef, scrollTargetId, focusOnPath);
  useCloseOnScroll(openNodeId !== null, () => onOpenNodeChange(null));
  const currentDirection = useNodeOffscreen(containerRef, currentNodeId);

  function goToCurrent() {
    const node = currentNodeId === null || !containerRef.current ? null : findNodeElement(containerRef.current, currentNodeId);
    node?.scrollIntoView({ block: "center", behavior: preferredScrollBehavior(true) });
  }

  return (
    // The bottom padding leaves room for a mascot beside a unit's last node, which reaches below the path.
    <div ref={containerRef} className="relative overflow-x-clip pb-10">
      <h1 className="sr-only">Learn</h1>
      {bannerUnit && <UnitBanner ref={bannerRef} unit={bannerUnit} />}
      {path.units.map((unit, unitIndex) => (
        <UnitSection
          key={unit.id}
          unit={unit}
          unitIndex={unitIndex}
          gems={gems}
          openNodeId={openNodeId}
          onOpenNodeChange={onOpenNodeChange}
          pending={pending}
          onAction={onAction}
          onClaimChest={onClaimChest}
        />
      ))}
      <GoToCurrentButton direction={currentDirection} onClick={goToCurrent} />
    </div>
  );
}

function unitOfNode(path: PathOut, nodeId: number | null): number | null {
  if (nodeId === null) return null;
  return path.units.find((unit) => unit.nodes.some((node) => node.id === nodeId))?.id ?? null;
}
