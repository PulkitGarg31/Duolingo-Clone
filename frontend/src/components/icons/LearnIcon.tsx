import { roundedPolygon } from "./geometry";
import { SvgIcon, type IconProps } from "./Icon";
import { ART, HIGHLIGHT } from "./palette";

// The roof and its lighter top share the apex and slopes, so the darker band shows only along the eaves.
const ROOF = roundedPolygon(
  [
    [16, 2.6],
    [29.5, 15.6],
    [2.5, 15.6],
  ],
  [3.2, 2.4, 2.4],
);
const ROOF_TOP = roundedPolygon(
  [
    [16, 2.6],
    [26.9, 13.1],
    [5.1, 13.1],
  ],
  [3.2, 1.8, 1.8],
);

/** Learn (nav): a rounded house with a red roof, a round gable window and an arched blue door. */
export function LearnIcon(props: IconProps) {
  return (
    <SvgIcon box={[32, 32]} {...props}>
      <rect x={7} y={12} width={18} height={17} rx={3} fill={ART.camel} />
      <path d="M10 12H21V29H10A3 3 0 0 1 7 26V15A3 3 0 0 1 10 12Z" fill={ART.bee} />
      <path d="M13 29V23.5A3 3 0 0 1 19 23.5V29Z" fill={ART.macaw} />
      <path d={ROOF} fill={ART.fireAnt} />
      <path d={ROOF_TOP} fill={ART.cardinal} />
      <circle cx={16} cy={9.6} r={2.1} fill={ART.white} />
      <path
        d="M8.9 11.6 11.6 9"
        stroke={HIGHLIGHT.color}
        strokeOpacity={HIGHLIGHT.opacity}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </SvgIcon>
  );
}
