import { roundedPolygon } from "./geometry";
import { ART } from "./palette";
import { ArtSvg, GroundShadow, Highlight, TwoTone, type IllustrationProps } from "./parts";

/** "el agua": a glass of water with a drop beside it. */
export function Water(props: IllustrationProps) {
  return (
    <ArtSvg {...props}>
      <GroundShadow cx={56} y={100} width={62} />
      <path d={roundedPolygon([[26, 20], [86, 20], [79, 104], [33, 104]], [3, 3, 9, 9])} fill={ART.iguana} />
      <TwoTone d={roundedPolygon([[28.4, 46], [83.6, 46], [79, 104], [33, 104]], [2, 2, 9, 9])} fill={ART.blueJay} shade={ART.macaw} offset={[9, 0]} />
      <Highlight x={34} y={28} width={6} height={62} rotate={-4} />
      <path
        d="M98 16C103 24 106 29 106 34A8 8 0 0 1 90 34C90 29 93 24 98 16Z"
        fill={ART.macaw}
        stroke={ART.macaw}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <circle cx={95} cy={33} r={2.2} fill={ART.white} fillOpacity={0.6} />
    </ArtSvg>
  );
}
