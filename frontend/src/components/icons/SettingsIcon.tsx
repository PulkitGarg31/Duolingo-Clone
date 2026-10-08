import { raysPath } from "./geometry";
import { LINE, SvgIcon, type IconProps } from "./Icon";

const TEETH = raysPath(12, 12, 6.6, 8.9, 6);

/** Settings: a gear with six round teeth around an open hub (`currentColor`). */
export function SettingsIcon(props: IconProps) {
  return (
    <SvgIcon box={[24, 24]} {...props}>
      <circle cx={12} cy={12} r={5.8} {...LINE} />
      <path d={TEETH} {...LINE} strokeWidth={3.4} />
    </SvgIcon>
  );
}
