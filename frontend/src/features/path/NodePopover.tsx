"use client";

import type { ReactElement } from "react";
import { CrownIcon, LockGlyph } from "@/components/icons";
import { Button, Popover, PopoverContent, PopoverTrigger, type PopoverTone } from "@/components/ui";
import type { PathNodeOut, UnitColor } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { nodePopoverModel, type NodeActionKind, type NodePopoverModel, type NodePopoverTone } from "./nodePopoverModel";
import type { CssVariables } from "./unitColors";

interface NodePopoverProps {
  node: PathNodeOut;
  unitColor: UnitColor;
  gems: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  side: "top" | "bottom";
  /** The action started from this popover and still in flight; its button shows loading dots. */
  pendingKind: NodeActionKind | null;
  onAction: (kind: NodeActionKind) => void;
  /** The node's face, which opens the popover and anchors its arrow. */
  children: ReactElement;
}

/** Gap between the face and the panel: the 8 px lip plus 12 px of air. */
const PANEL_OFFSET = 20;

/** The panel a node opens: what it is, where the learner stands, and what can be started from here. */
export function NodePopover({ node, unitColor, gems, open, onOpenChange, side, pendingKind, onAction, children }: NodePopoverProps) {
  const model = nodePopoverModel(node, gems);
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        side={side}
        offset={PANEL_OFFSET}
        tone={POPOVER_TONE[model.tone]}
        style={surfaceStyle(model.tone, unitColor)}
        aria-label={model.title}
        className="w-[295px] p-4 md:w-[343px]"
      >
        <NodePopoverBody model={model} pendingKind={pendingKind} onAction={onAction} />
      </PopoverContent>
    </Popover>
  );
}

const POPOVER_TONE: Record<NodePopoverTone, PopoverTone> = {
  unit: "surface",
  legendary: "surface",
  locked: "subtle",
  muted: "subtle",
};

/** The panel is portalled out of the unit, so it gets the unit colour as `--surface` directly. */
function surfaceStyle(tone: NodePopoverTone, unitColor: UnitColor): CssVariables | undefined {
  if (tone === "unit") return { "--surface": `var(--unit-${unitColor})` };
  if (tone === "legendary") return { "--surface": "var(--unit-gold)", "--surface-ink": "var(--unit-gold-dark)" };
  return undefined;
}

interface NodePopoverBodyProps {
  model: NodePopoverModel;
  pendingKind: NodeActionKind | null;
  onAction: (kind: NodeActionKind) => void;
}

function NodePopoverBody({ model, pendingKind, onAction }: NodePopoverBodyProps) {
  const grey = model.tone === "locked" || model.tone === "muted";
  return (
    <div>
      <h3 className={cn("text-card-title", grey && "text-fg-2")}>{model.title}</h3>
      <p className={cn("mt-1 text-[17px] leading-[26.6px] font-semibold", grey && "text-fg-3")}>{model.subtitle}</p>
      {model.actions.length > 0 && (
        <div className="mt-4 flex flex-col gap-2">
          {model.actions.map((action) => (
            <div key={action.kind}>
              <Button
                variant={action.variant}
                fullWidth
                disabled={action.disabled || (pendingKind !== null && pendingKind !== action.kind)}
                loading={pendingKind === action.kind}
                onClick={() => onAction(action.kind)}
              >
                {action.kind === "legendary" && <CrownIcon variant="mono" size={16} />}
                {action.label}
              </Button>
              {action.caption && <p className="text-center text-[13px] leading-4 font-semibold opacity-80">{action.caption}</p>}
            </div>
          ))}
        </div>
      )}
      {model.locked && (
        <Button variant="locked" fullWidth className="mt-4">
          <LockGlyph size={16} />
          Locked
        </Button>
      )}
    </div>
  );
}
