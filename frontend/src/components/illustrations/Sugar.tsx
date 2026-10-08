import { roundedPolygon } from "./geometry";
import { ART } from "./palette";
import { ArtSvg, GroundShadow, Highlight, TwoTone, type IllustrationProps } from "./parts";

/** Sugar cubes inside the jar, as [x, y, rotation]: two rows, slightly askew. */
const CUBES = [
  [30, 80, -6],
  [52, 81, 4],
  [74, 80, -3],
  [40, 61, 8],
  [62, 61, -5],
] as const;

const CUBE_SIZE = 18;

/** "el azúcar": a glass jar full of sugar cubes, with a purple lid. */
export function Sugar(props: IllustrationProps) {
  return (
    <ArtSvg {...props}>
      <GroundShadow cx={60} y={100} width={80} />
      <TwoTone d={roundedPolygon([[22, 34], [98, 34], [98, 104], [22, 104]], [8, 8, 16, 16])} fill={ART.iguana} shade={ART.anchovy} offset={[12, 0]} />
      {CUBES.map(([x, y, rotate]) => (
        <g key={`${x}-${y}`} transform={`rotate(${rotate} ${x + CUBE_SIZE / 2} ${y + CUBE_SIZE / 2})`}>
          <TwoTone
            d={roundedPolygon([[x, y], [x + CUBE_SIZE, y], [x + CUBE_SIZE, y + CUBE_SIZE], [x, y + CUBE_SIZE]], 4)}
            fill={ART.white}
            shade={ART.anchovy}
            offset={[4, 3]}
          />
        </g>
      ))}
      <Highlight x={28} y={42} width={6} height={48} />
      <rect x={51} y={12} width={18} height={12} rx={4} fill={ART.beetleShade} />
      <TwoTone d={roundedPolygon([[18, 20], [102, 20], [102, 38], [18, 38]], 7)} fill={ART.beetle} shade={ART.beetleShade} offset={[12, 0]} />
      <path
        d="M106 46C107.4 51.6 108.4 52.6 114 54C108.4 55.4 107.4 56.4 106 62C104.6 56.4 103.6 55.4 98 54C103.6 52.6 104.6 51.6 106 46Z"
        fill={ART.bee}
        stroke={ART.bee}
        strokeWidth={2}
        strokeLinejoin="round"
      />
    </ArtSvg>
  );
}
