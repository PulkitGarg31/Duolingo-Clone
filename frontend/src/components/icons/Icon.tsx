import type { ReactNode } from "react";

/** Props every icon accepts. */
export interface IconProps {
  /** Width in CSS pixels; the height follows the artboard's aspect ratio. Defaults to the artboard width. */
  size?: number;
  className?: string;
  /**
   * Accessible name, for an icon that carries meaning on its own. Without it the icon is decorative and hidden
   * from assistive technology (an icon-only button names itself with `aria-label` instead).
   */
  title?: string;
}

/** Stroke style of the one-colour line icons on the 24-unit grid: 2.5 units, round ends and joins. */
export const LINE = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2.5,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

interface SvgIconProps extends IconProps {
  /** Artboard width and height in drawing units. */
  box: readonly [width: number, height: number];
  children: ReactNode;
}

/** The <svg> element shared by every icon: artboard, pixel size and accessibility. */
export function SvgIcon({ box: [width, height], size = width, className, title, children }: SvgIconProps) {
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={size}
      height={(size * height) / width}
      className={className}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}
