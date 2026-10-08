import { roundedPolygon } from "./geometry";
import { ART } from "./palette";
import { ArtSvg, GroundShadow, Highlight, TwoTone, type IllustrationProps } from "./parts";

/** "el jugo": a glass of orange juice with a straw and a slice of orange on the rim. */
export function Juice(props: IllustrationProps) {
  return (
    <ArtSvg {...props}>
      <GroundShadow cx={58} y={100} width={62} />
      <path d={roundedPolygon([[28, 22], [88, 22], [81, 104], [35, 104]], [3, 3, 9, 9])} fill={ART.iguana} />
      <TwoTone d={roundedPolygon([[29.9, 40], [86.1, 40], [81, 104], [35, 104]], [2, 2, 9, 9])} fill={ART.fox} shade={ART.foxShade} offset={[9, 0]} />
      <rect x={64} y={4} width={7} height={58} rx={3.5} fill={ART.cardinal} transform="rotate(16 67 60)" />
      <path d="M16 30A16 16 0 0 1 48 30Z" fill={ART.fox} />
      <path d="M20 30A12 12 0 0 1 44 30Z" fill={ART.bee} />
      <g stroke={ART.fox} strokeWidth={2} strokeLinecap="round">
        <path d="M32 30L23.5 21.5M32 30V18M32 30L40.5 21.5" />
      </g>
      <Highlight x={36} y={46} width={6} height={44} rotate={-4} />
    </ArtSvg>
  );
}
