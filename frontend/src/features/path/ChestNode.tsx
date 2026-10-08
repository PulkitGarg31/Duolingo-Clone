"use client";

import { motion } from "motion/react";
import { useState, type MouseEvent } from "react";
import { ChestIcon } from "@/components/icons";
import { useValueChange } from "@/features/shell/useValueChange";
import { GEM_COUNTER_SELECTOR } from "@/features/stats/GemsStat";
import type { PathNodeOut, UnitColor } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { GemBurst, type GemFlight } from "./GemBurst";
import { NodePopover } from "./NodePopover";
import { nodeAriaLabel } from "./nodePresentation";
import { StartBubble } from "./StartBubble";

export interface ChestNodeProps {
  node: PathNodeOut;
  unitColor: UnitColor;
  gems: number;
  popoverSide: "top" | "bottom";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Shows the OPEN bubble: the unit's call to action when no lesson is current. */
  showBubble: boolean;
  onClaim: (node: PathNodeOut) => void;
}

/** The chest art fills about 24 × 23 of its 32-unit artboard, so at 88 px it is node-sized (66 × 64). */
const CHEST_SIZE = 88;
/** The artboard's empty bottom margin (4 of 32 units) hangs below the slot, so the chest stands where a node's lip ends. */
const CHEST_BOX = "absolute -bottom-[11px] left-1/2 -translate-x-1/2";
const CHEST_BUTTON =
  "cursor-pointer rounded-md [-webkit-tap-highlight-color:transparent] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

/**
 * A treasure chest on the path. Locked, it explains itself in a popover; reachable, it wiggles (under an OPEN
 * bubble when it is the unit's next step) and opens on click (no popover), sending its gems flying to the gem
 * counter; claimed, it stays open and faded.
 */
export function ChestNode({ node, unitColor, gems, popoverSide, open, onOpenChange, showBubble, onClaim }: ChestNodeProps) {
  const [flight, setFlight] = useState<GemFlight | null>(null);
  const { reducedMotion } = useTheme();
  const change = useValueChange(node.state);
  const justOpened = change.previous === "available" && node.state === "completed";

  function claim(event: MouseEvent<HTMLButtonElement>) {
    if (!reducedMotion) setFlight(gemFlight(event.currentTarget));
    onClaim(node);
  }

  return (
    <div className="relative h-[65px] w-[70px]" data-node-id={node.id}>
      {node.state === "locked" && (
        <NodePopover
          node={node}
          unitColor={unitColor}
          gems={gems}
          open={open}
          onOpenChange={onOpenChange}
          side={popoverSide}
          pendingKind={null}
          onAction={() => undefined}
        >
          <button type="button" aria-label={nodeAriaLabel(node)} className={cn(CHEST_BOX, CHEST_BUTTON)}>
            <ChestIcon variant="locked" size={CHEST_SIZE} />
          </button>
        </NodePopover>
      )}

      {node.state === "available" && (
        <>
          {showBubble && <StartBubble label="Open" />}
          <button type="button" aria-label={nodeAriaLabel(node)} onClick={claim} className={cn(CHEST_BOX, CHEST_BUTTON)}>
            <motion.span
              className="block origin-bottom"
              animate={{ rotate: [0, -6, 6, 0] }}
              transition={{ duration: 0.3, repeat: Infinity, repeatDelay: 2.7 }}
            >
              <ChestIcon variant="closed" size={CHEST_SIZE} />
            </motion.span>
          </button>
        </>
      )}

      {(node.state === "completed" || node.state === "legendary") && (
        <span role="img" aria-label={nodeAriaLabel(node)} className={CHEST_BOX}>
          <motion.span
            className="block"
            initial={justOpened ? { scale: 1.15, y: 0, opacity: 1 } : false}
            animate={{ scale: 1, y: -6, opacity: 0.6 }}
            transition={{ duration: 0.3, opacity: { delay: 0.8, duration: 0.4 } }}
          >
            <ChestIcon variant="open" size={CHEST_SIZE} />
          </motion.span>
        </span>
      )}

      {flight && <GemBurst flight={flight} onDone={() => setFlight(null)} />}
    </div>
  );
}

/** From the chest's centre to the visible gem counter (or straight up when no stats row is on screen). */
function gemFlight(chest: HTMLElement): GemFlight {
  const from = centreOf(chest.getBoundingClientRect());
  const counter = Array.from(document.querySelectorAll<HTMLElement>(GEM_COUNTER_SELECTOR)).find(
    (element) => element.getClientRects().length > 0,
  );
  const target = counter?.querySelector("svg") ?? counter;
  return { from, to: target ? centreOf(target.getBoundingClientRect()) : { x: from.x, y: from.y - 160 } };
}

function centreOf(rect: DOMRect): { x: number; y: number } {
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}
