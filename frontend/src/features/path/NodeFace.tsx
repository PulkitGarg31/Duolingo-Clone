import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

/** `unit`: the unit's colour · `gold`: Legendary · `locked`: the theme's grey. */
export type NodeFaceTone = "unit" | "gold" | "locked";

const TONE_VARIABLES: Record<NodeFaceTone, string> = {
  unit: "[--node:var(--unit)] [--node-lip:var(--unit-lip)] [--node-shine:var(--unit-shine)] text-on-color-fixed",
  gold: "[--node:var(--unit-gold)] [--node-lip:var(--unit-gold-lip)] [--node-shine:var(--unit-gold-shine)] text-on-color-fixed",
  locked: "[--node:var(--c-node-locked)] [--node-lip:var(--c-node-locked-lip)] text-(--c-node-locked-glyph)",
};

interface NodeFaceProps extends ComponentProps<"button"> {
  tone: NodeFaceTone;
}

/**
 * A path node's pressable face: a 70 × 57 ellipse on an 8 px lip. Hovering sinks it 1.5 px, pressing sinks it
 * onto its lip. Its colour fades over 300 ms, which is what a node unlocking looks like.
 */
export function NodeFace({ tone, className, ...rest }: NodeFaceProps) {
  return (
    <button
      type="button"
      className={cn(
        "relative z-[1] grid h-[57px] w-[70px] cursor-pointer place-items-center rounded-[50%] bg-(--node)",
        "shadow-[0_8px_0_var(--node-lip)] [-webkit-tap-highlight-color:transparent]",
        "[transition:translate_100ms_linear,box-shadow_100ms_linear,background-color_300ms,color_300ms]",
        "hover:translate-y-[1.5px] hover:shadow-[0_6.5px_0_var(--node-lip)]",
        "active:translate-y-2 active:shadow-[0_0_0_var(--node-lip)]",
        "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus",
        TONE_VARIABLES[tone],
        className,
      )}
      {...rest}
    />
  );
}
