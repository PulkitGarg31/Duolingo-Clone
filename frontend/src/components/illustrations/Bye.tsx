import { roundedPolygon } from "./geometry";
import { OpenHand } from "./hands";
import { ART, SKIN } from "./palette";
import { ArtSvg, GroundShadow, Highlight, TwoTone, type IllustrationProps } from "./parts";

/** "adiós": a packed suitcase and a hand waving goodbye. */
export function Bye(props: IllustrationProps) {
  return (
    <ArtSvg {...props}>
      <GroundShadow cx={80} y={103} width={62} />
      <path d="M68 58V49Q68 43 74 43H88Q94 43 94 49V58" fill="none" stroke={ART.beetleShade} strokeWidth={6} strokeLinecap="round" />
      <TwoTone d={roundedPolygon([[50, 56], [112, 56], [112, 107], [50, 107]], 9)} fill={ART.beetle} shade={ART.beetleShade} offset={[9, 0]} />
      <g fill={ART.beetleShade}>
        <rect x={61} y={56} width={7} height={51} />
        <rect x={94} y={56} width={7} height={51} />
      </g>
      <rect x={73} y={72} width={16} height={11} rx={3.5} fill={ART.bee} />
      <Highlight x={54} y={61} width={4.5} height={16} />
      <OpenHand skin={SKIN.brown} cuff={ART.fox} cuffShade={ART.foxShade} transform="translate(-2 0) scale(0.58) rotate(-14 60 112)" />
      <g fill="none" stroke={ART.macaw} strokeWidth={4} strokeLinecap="round">
        <path d="M52 10Q58 16 58 25" />
        <path d="M10 18Q5 25 6 34" />
      </g>
    </ArtSvg>
  );
}
