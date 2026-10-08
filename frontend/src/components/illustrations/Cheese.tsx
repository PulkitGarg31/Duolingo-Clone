import { roundedPolygon } from "./geometry";
import { ART } from "./palette";
import { ArtSvg, GroundShadow, Highlight, TwoTone, type IllustrationProps } from "./parts";

/** "el queso": a wedge of cheese with holes, its paler top catching the light. */
export function Cheese(props: IllustrationProps) {
  return (
    <ArtSvg {...props}>
      <GroundShadow cx={60} y={98} width={98} />
      <path d={roundedPolygon([[12, 60], [106, 60], [34, 30]], [4, 4, 8])} fill={ART.duck} />
      <TwoTone d={roundedPolygon([[12, 60], [106, 60], [106, 102], [12, 102]], [3, 3, 8, 8])} fill={ART.bee} shade={ART.lion} offset={[10, 0]} />
      <g fill={ART.camel}>
        <circle cx={32} cy={78} r={7} />
        <circle cx={56} cy={88} r={4.5} />
        <circle cx={74} cy={74} r={8} />
        <circle cx={96} cy={90} r={4} />
        <circle cx={40} cy={50} r={4} />
        <circle cx={58} cy={52} r={3} />
      </g>
      <Highlight x={18} y={66} width={5} height={14} />
    </ArtSvg>
  );
}
