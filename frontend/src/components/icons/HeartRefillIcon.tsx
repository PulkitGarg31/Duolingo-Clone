import { SvgIcon, type IconProps } from "./Icon";
import { ART } from "./palette";
import { HeartArt } from "./parts";

/** Refill hearts: the red heart with a green "+" badge on its lower right. */
export function HeartRefillIcon(props: IconProps) {
  return (
    <SvgIcon box={[32, 32]} {...props}>
      <g transform="translate(-0.6 -0.4) scale(0.86)">
        <HeartArt fill={ART.cardinal} shade={ART.fireAnt} highlight={ART.flamingo} />
      </g>
      <circle cx={24.2} cy={24.2} r={6.6} fill={ART.treeFrog} />
      <circle cx={24.2} cy={23.2} r={6.6} fill={ART.owl} />
      <path d="M24.2 20V26.4M21 23.2H27.4" stroke={ART.white} strokeWidth={2.4} strokeLinecap="round" />
    </SvgIcon>
  );
}
