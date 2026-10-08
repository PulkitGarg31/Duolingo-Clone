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

/** Slowly turning light rays behind a trophy or a badge. */
export function Rays({ color, optional = false, className }: RaysProps) {
  const style: CSSProperties & Record<"--ray-color", string> = { "--ray-color": color };
  return <div aria-hidden="true" className={cn(styles.rays, optional && styles.optional, className)} style={style} />;
}
