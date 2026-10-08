import { LINE, SvgIcon, type IconProps } from "./Icon";

export type ChevronDirection = "left" | "right" | "up" | "down";

const ROTATION: Record<ChevronDirection, number> = { right: 0, down: 90, left: 180, up: 270 };

/** A chevron pointing `direction` (`currentColor`). */
export function ChevronIcon({ direction = "right", ...props }: IconProps & { direction?: ChevronDirection }) {
  return (
    <SvgIcon box={[24, 24]} {...props}>
      <path d="M9 5.5 15.5 12 9 18.5" {...LINE} transform={`rotate(${ROTATION[direction]} 12 12)`} />
    </SvgIcon>
  );
}
