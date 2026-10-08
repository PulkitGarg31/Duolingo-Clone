import { arcPath } from "./geometry";
import { SvgIcon, type IconProps } from "./Icon";
import { ART, HIGHLIGHT } from "./palette";

/** More (nav): a purple disc holding three white dots. */
export function MoreIcon(props: IconProps) {
  return (
    <SvgIcon box={[32, 32]} {...props}>
      {/* the lighter disc sits up and left inside the darker one, leaving a crescent of shade at the lower right */}
      <circle cx={16} cy={16} r={13.5} fill={ART.beetleLip} />
      <circle cx={15.3} cy={15.3} r={12.5} fill={ART.beetle} />
      <circle cx={10} cy={16} r={2} fill={ART.white} />
      <circle cx={16} cy={16} r={2} fill={ART.white} />
      <circle cx={22} cy={16} r={2} fill={ART.white} />
      <path
        d={arcPath(15.3, 15.3, 9.3, 200, 245)}
        fill="none"
        stroke={HIGHLIGHT.color}
        strokeOpacity={HIGHLIGHT.opacity}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </SvgIcon>
  );
}
