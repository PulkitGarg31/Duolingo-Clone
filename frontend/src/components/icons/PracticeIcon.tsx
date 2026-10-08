import { SvgIcon, type IconProps } from "./Icon";
import { ART, HIGHLIGHT } from "./palette";

/** Practice (nav): a blue dumbbell tilted up to the right, two plates per side with the inner plate darker. */
export function PracticeIcon(props: IconProps) {
  return (
    <SvgIcon box={[32, 32]} {...props}>
      <g transform="rotate(-30 16 16)">
        <rect x={11} y={14.5} width={10} height={3} rx={1.5} fill={ART.hare} />
        <rect x={3.4} y={11} width={5.4} height={10} rx={2.4} fill={ART.macaw} />
        <rect x={23.2} y={11} width={5.4} height={10} rx={2.4} fill={ART.macaw} />
        {/* the inner plates overlap the outer ones */}
        <rect x={7.8} y={8.5} width={5.2} height={15} rx={2.6} fill={ART.whale} />
        <rect x={19} y={8.5} width={5.2} height={15} rx={2.6} fill={ART.whale} />
        <path
          d="M10 11.4V14.2M21.2 11.4V14.2"
          stroke={HIGHLIGHT.color}
          strokeOpacity={HIGHLIGHT.opacity}
          strokeWidth={1.6}
          strokeLinecap="round"
        />
      </g>
    </SvgIcon>
  );
}
