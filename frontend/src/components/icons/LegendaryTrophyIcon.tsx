import { roundedPolygon, starPoints } from "./geometry";
import { SvgIcon, type IconProps } from "./Icon";
import { ART } from "./palette";

const CUP = "M18 11H46V25C46 33.3 39.7 40 32 40C24.3 40 18 33.3 18 25Z";
// The cup's right side in shade: a crescent from the rim down to the bottom of the bowl.
const CUP_SHADE = "M38.5 11H46V25C46 32.1 41.5 38 35.3 39.6C37.3 35.6 38.5 30.6 38.5 25Z";
const STAR = roundedPolygon(starPoints(32, 25.6, 8.2, 3.9), [1.6, 0.8]);

/** Legendary: a big gold cup with loop handles and a star on its face (64-unit artboard). */
export function LegendaryTrophyIcon(props: IconProps) {
  return (
    <SvgIcon box={[64, 64]} {...props}>
      <path
        d="M18.5 15.5H13.6C11.6 15.5 10.2 16.9 10.2 18.9C10.2 24.6 14 28.8 19.6 29.8"
        fill="none"
        stroke={ART.bee}
        strokeWidth={4.4}
        strokeLinecap="round"
      />
      <path
        d="M45.5 15.5H50.4C52.4 15.5 53.8 16.9 53.8 18.9C53.8 24.6 50 28.8 44.4 29.8"
        fill="none"
        stroke={ART.camel}
        strokeWidth={4.4}
        strokeLinecap="round"
      />
      <rect x={28} y={38} width={8} height={9} fill={ART.camel} />
      <rect x={28} y={38} width={4} height={9} fill={ART.bee} />
      <rect x={20} y={46} width={24} height={10} rx={3.2} fill={ART.camel} />
      <path d="M23.2 46H40.8A3.2 3.2 0 0 1 44 49.2V51.6H20V49.2A3.2 3.2 0 0 1 23.2 46Z" fill={ART.bee} />
      <path d={CUP} fill={ART.bee} />
      <path d={CUP_SHADE} fill={ART.camel} />
      <rect x={15.5} y={8} width={33} height={6} rx={3} fill={ART.bee} />
      <path d="M48.5 11A3 3 0 0 1 45.5 14H40V8H45.5A3 3 0 0 1 48.5 11Z" fill={ART.camel} />
      <path d={STAR} fill={ART.white} />
      <path d="M22.6 17.4V24.4" stroke={ART.goldShine} strokeWidth={3} strokeLinecap="round" />
    </SvgIcon>
  );
}
