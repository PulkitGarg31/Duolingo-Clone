import { arcPath } from "./geometry";
import { SvgIcon, type IconProps } from "./Icon";
import { ART, HIGHLIGHT } from "./palette";

/** Accuracy (and the "perfect lessons" quest): a green target, three rings around a white bullseye. */
export function TargetIcon(props: IconProps) {
  return (
    <SvgIcon box={[32, 32]} {...props}>
      <circle cx={16} cy={16} r={13.6} fill={ART.treeFrog} />
      <circle cx={15.4} cy={15.4} r={13} fill={ART.owl} />
      <circle cx={15.6} cy={15.6} r={9.8} fill={ART.white} />
      <circle cx={15.6} cy={15.6} r={6.6} fill={ART.owl} />
      <circle cx={15.6} cy={15.6} r={3.2} fill={ART.white} />
      <path
        d={arcPath(15.4, 15.4, 11.4, 205, 245)}
        fill="none"
        stroke={HIGHLIGHT.color}
        strokeOpacity={HIGHLIGHT.opacity}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
    </SvgIcon>
  );
}
