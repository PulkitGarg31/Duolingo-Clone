"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { ChestNode } from "@/features/path/ChestNode";
import { PathNode } from "@/features/path/PathNode";
import { unitColorVariables } from "@/features/path/unitColors";
import type { PathNodeOut, PathOut, UnitColor } from "@/lib/api/types";
import { Example, GallerySection } from "../shell/parts/GallerySection";
import { PATH, PATH_DRINKS_DONE } from "./fixtures";

/** A node of a fixture path, by id. */
function nodeById(id: number, path: PathOut = PATH): PathNodeOut {
  const found = path.units.flatMap((unit) => unit.nodes).find((node) => node.id === id);
  if (!found) throw new Error(`No node ${id} in the fixture path`);
  return found;
}

const EXAMPLES: ReadonlyArray<{ label: string; node: PathNodeOut; color: UnitColor; gems?: number }> = [
  { label: "Current lesson", node: nodeById(6), color: "purple" },
  { label: "Completed", node: nodeById(5), color: "purple" },
  { label: "Completed, gems short", node: nodeById(2), color: "green", gems: 40 },
  { label: "Legendary", node: nodeById(1), color: "green" },
  { label: "Unit review, current", node: nodeById(8, PATH_DRINKS_DONE), color: "purple" },
  { label: "Unit review, completed", node: nodeById(4), color: "green" },
  { label: "Locked", node: nodeById(9), color: "teal" },
  { label: "Locked chest", node: nodeById(7), color: "purple" },
];

/** Each node state on its unit colour, popovers open, plus the three chest states. */
export function NodeStatesGallery() {
  const [popoversOpen, setPopoversOpen] = useState(true);
  return (
    <GallerySection title="Node states">
      <div className="w-full">
        <Button size="sm" variant="secondary" onClick={() => setPopoversOpen((open) => !open)}>
          {popoversOpen ? "Close popovers" : "Open popovers"}
        </Button>
      </div>
      {EXAMPLES.map(({ label, node, color, gems = 820 }) => (
        <Example key={label} label={label} className="h-[400px] w-[330px]">
          <div className="flex justify-center pt-20" style={unitColorVariables(color)}>
            {node.kind === "chest" ? (
              <ChestNode
                node={node}
                unitColor={color}
                gems={gems}
                popoverSide="bottom"
                open={popoversOpen}
                onOpenChange={() => undefined}
                showBubble={false}
                onClaim={() => undefined}
              />
            ) : (
              <PathNode
                node={node}
                unitColor={color}
                gems={gems}
                popoverSide="bottom"
                open={popoversOpen}
                onOpenChange={() => undefined}
                pendingKind={null}
                onAction={() => undefined}
              />
            )}
          </div>
        </Example>
      ))}
      <Example label="Chests: reachable, opened" className="w-[330px]">
        <div className="flex justify-center gap-16 pt-20" style={unitColorVariables("purple")}>
          <ChestNode
            node={nodeById(7, PATH_DRINKS_DONE)}
            unitColor="purple"
            gems={820}
            popoverSide="bottom"
            open={false}
            onOpenChange={() => undefined}
            showBubble
            onClaim={() => undefined}
          />
          <ChestNode
            node={nodeById(3)}
            unitColor="green"
            gems={820}
            popoverSide="bottom"
            open={false}
            onOpenChange={() => undefined}
            showBubble
            onClaim={() => undefined}
          />
        </div>
      </Example>
    </GallerySection>
  );
}
