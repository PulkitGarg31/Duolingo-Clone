import { roundedPolygon } from "./geometry";
import { ART } from "./palette";
import { ArtSvg, GroundShadow, Highlight, TwoTone, type IllustrationProps } from "./parts";

/** "el café": a red mug of steaming coffee. */
export function Coffee(props: IllustrationProps) {
  return (
    <ArtSvg {...props}>
      <GroundShadow cx={58} y={100} width={74} />
      <g fill="none" stroke={ART.hare} strokeWidth={4.5} strokeLinecap="round">
        <path d="M40 26C36 20 44 15 40 8" />
        <path d="M55 26C51 20 59 15 55 8" />
        <path d="M70 26C66 20 74 15 70 8" />
      </g>
      <circle cx={88} cy={66} r={13} fill="none" stroke={ART.fireAnt} strokeWidth={8} />
      <TwoTone d={roundedPolygon([[20, 34], [90, 34], [90, 104], [20, 104]], [6, 6, 13, 13])} fill={ART.cardinal} shade={ART.fireAnt} offset={[10, 0]} />
      <rect x={25} y={36} width={60} height={9} rx={4.5} fill={ART.woodShade} />
      <Highlight x={27} y={52} width={7} height={26} />
    </ArtSvg>
  );
}
