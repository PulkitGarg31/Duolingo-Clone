import { roundedPolygon } from "./geometry";
import { SvgIcon, type IconProps } from "./Icon";

const ARROW_UP = roundedPolygon(
  [
    [12, 3.2],
    [20.4, 12],
    [14.8, 12],
    [14.8, 20.6],
    [9.2, 20.6],
    [9.2, 12],
    [3.6, 12],
  ],
  [1.6, 1.4, 0.8, 1.4, 1.4, 0.8, 1.4],
);

/** Promotion and demotion zones, "go to current unit": a solid arrow with soft corners (`currentColor`). */
export function ArrowIcon({ direction = "up", ...props }: IconProps & { direction?: "up" | "down" }) {
  return (
    <SvgIcon box={[24, 24]} {...props}>
      <path d={ARROW_UP} fill="currentColor" transform={direction === "down" ? "rotate(180 12 12)" : undefined} />
    </SvgIcon>
  );
}
