import { raysPath } from "./geometry";
import { LINE, SvgIcon, type IconProps } from "./Icon";

const RAYS = raysPath(12, 12, 7.4, 9.4, 8);

/** Light theme: a sun with eight short rays (`currentColor`). */
export function SunIcon(props: IconProps) {
  return (
    <SvgIcon box={[24, 24]} {...props}>
      <circle cx={12} cy={12} r={4.4} {...LINE} />
      <path d={RAYS} {...LINE} />
    </SvgIcon>
  );
}
