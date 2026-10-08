import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

interface ProgressRingProps {
  /** Progress from 0 to 1; values outside are clamped. */
  value: number;
  /** Outer diameter in px. */
  size: number;
  /** Ring thickness in px. */
  stroke: number;
  /** Any CSS colour, usually a token such as "var(--c-xp)" or "var(--unit)". */
  color: string;
  trackColor?: string;
  /** Accessible name. Leave it out when nearby text already states the progress. */
  label?: string;
  /** Content centred in the ring, such as the XP bolt. */
  children?: ReactNode;
  className?: string;
}

/**
 * A circular track with an arc that grows clockwise from 12 o'clock (the daily-goal ring, a path node's
 * lesson progress). SVG attributes cannot read CSS variables, so colours go through `style`.
 */
export function ProgressRing({
  value,
  size,
  stroke,
  color,
  trackColor = "var(--c-track)",
  label,
  children,
  className,
}: ProgressRingProps) {
  const progress = Math.min(1, Math.max(0, value));
  const center = size / 2;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  return (
    <span
      role={label ? "img" : undefined}
      aria-label={label}
      className={cn("relative inline-grid shrink-0 place-items-center", className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" className="absolute inset-0">
        <circle cx={center} cy={center} r={radius} fill="none" strokeWidth={stroke} style={{ stroke: trackColor }} />
        {/* Hidden at 0, where the round cap of an empty arc would still draw a dot. */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - progress)}
          transform={`rotate(-90 ${center} ${center})`}
          style={{
            stroke: color,
            opacity: progress > 0 ? 1 : 0,
            transition: "stroke-dashoffset var(--dur-base) var(--ease-standard)",
          }}
        />
      </svg>
      {children}
    </span>
  );
}
