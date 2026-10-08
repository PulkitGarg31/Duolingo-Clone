import type { CSSProperties } from "react";
import { cn } from "@/lib/cn";
import styles from "./completion.module.css";

interface RaysProps {
  /** The rays' colour, usually a palette colour at partial alpha. */
  color: string;
  /** Pure decoration: hidden when motion is reduced instead of standing still. */
  optional?: boolean;
  /** Size and position; the rays fill this box. */
  className?: string;
}

/**
 * Slowly turning light rays behind a trophy or a badge. The rays fade out inside the box's inscribed circle,
 * so clipping to that circle hides nothing, and it keeps the turning square's corners from widening the page.
 */
export function Rays({ color, optional = false, className }: RaysProps) {
  const style: CSSProperties & Record<"--ray-color", string> = { "--ray-color": color };
  return (
    <div aria-hidden="true" className={cn("overflow-hidden rounded-full", optional && styles.optional, className)}>
      <div className={cn("size-full", styles.rays)} style={style} />
    </div>
  );
}
