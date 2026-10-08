import { roundedPolygon } from "./geometry";
import { ART } from "./palette";
import { ArtSvg, GroundShadow, Highlight, TwoTone, type IllustrationProps } from "./parts";

/** "la leche": a carton of milk with a drop on its label. */
export function Milk(props: IllustrationProps) {
  return (
    <ArtSvg {...props}>
      <GroundShadow cx={60} y={100} width={66} />
      <rect x={51} y={10} width={18} height={12} rx={3} fill={ART.humpback} />
      <TwoTone d={roundedPolygon([[30, 44], [90, 44], [60, 18]], [3, 3, 4])} fill={ART.whale} shade={ART.humpback} offset={[8, 0]} />
      <TwoTone d={roundedPolygon([[30, 44], [90, 44], [90, 104], [30, 104]], [2, 2, 8, 8])} fill={ART.blueJay} shade={ART.macaw} offset={[12, 0]} />
      <rect x={38} y={58} width={40} height={36} rx={8} fill={ART.white} />
      <path
        d="M58 63C63 70 66 74 66 78A8 8 0 0 1 50 78C50 74 53 70 58 63Z"
        fill={ART.macaw}
        stroke={ART.macaw}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <Highlight x={33} y={48} width={4} height={44} />
    </ArtSvg>
  );
}
