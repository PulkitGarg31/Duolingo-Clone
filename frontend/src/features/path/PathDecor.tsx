import { Owl, type OwlPose } from "@/components/mascot";
import { cn } from "@/lib/cn";
import type { CssVariables } from "./unitColors";

/** The mascot's pose beside each unit, in turn: waving, reading, with a coffee, with a flag. */
const UNIT_POSES: readonly OwlPose[] = ["wave", "read", "coffee", "flag"];
/** Long units get a second mascot; it idles. */
const SECOND_POSE: OwlPose = "idle";

interface PathDecorProps {
  side: "left" | "right";
  unitIndex: number;
  /** The second decoration of a long unit. */
  second?: boolean;
  /** Horizontal offset of the node the mascot sits beside, in px. */
  nodeX: number;
  /** Units not reached yet show a faded, grey mascot. */
  faded: boolean;
}

/**
 * The owl standing beside a unit's path, vertically centred on its anchor node and pushed out to ±133 px from
 * the column's centre line (107 / 117 px on phones). It sits inside the anchor node's list item, so the offset
 * subtracts that node's own shift. Purely decorative.
 */
export function PathDecor({ side, unitIndex, second = false, nodeX, faded }: PathDecorProps) {
  const pose = second ? SECOND_POSE : UNIT_POSES[unitIndex % UNIT_POSES.length];
  const position: CssVariables = { "--node-x": `${nodeX}px` };
  return (
    <div
      aria-hidden="true"
      style={position}
      className={cn(
        "pointer-events-none absolute top-[28.5px] left-1/2",
        side === "right" ? "[--decor-x:107px] md:[--decor-x:133px]" : "[--decor-x:-117px] md:[--decor-x:-133px]",
        "[translate:calc(var(--decor-x)-var(--node-x)-50%)_-50%]",
        faded && "opacity-50 grayscale",
      )}
    >
      <Owl pose={pose} size={200} className="size-[150px] md:size-[200px]" />
    </div>
  );
}
