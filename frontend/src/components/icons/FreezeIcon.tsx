import { SvgIcon, type IconProps } from "./Icon";
import { ART } from "./palette";
import { FLAME, FLAME_CORE } from "./shapes";

/** Streak Freeze: an ice cube with a blue flame held inside it. */
export function FreezeIcon(props: IconProps) {
  return (
    <SvgIcon box={[32, 32]} {...props}>
      {/* The lighter face shares the cube's top-left corner but is smaller: shade shows along right and bottom. */}
      <rect x={3.5} y={4.5} width={25} height={24.5} rx={5.5} fill={ART.blueJay} />
      <rect x={3.5} y={4.5} width={23} height={22.4} rx={5.5} fill={ART.iguana} />
      <g transform="translate(15 16.4) scale(0.56) translate(-16 -16)">
        <path d={FLAME} fill={ART.macaw} />
        <path d={FLAME_CORE} fill={ART.iguana} />
      </g>
      <path
        d="M7.4 12.4V9.8C7.4 9 8 8.4 8.8 8.4H11.6"
        fill="none"
        stroke={ART.white}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </SvgIcon>
  );
}
