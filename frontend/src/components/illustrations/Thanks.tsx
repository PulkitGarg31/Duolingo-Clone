import { roundedPolygon } from "./geometry";
import { ART, SKIN } from "./palette";
import { ArtSvg, Highlight, TwoTone, type IllustrationProps } from "./parts";

const SKIN_TONE = SKIN.tan;
const HEART = "M60 82C38 69 24 57 24 41C24 29 33 21 44 21C51 21 57 25 60 31C63 25 69 21 76 21C87 21 96 29 96 41C96 57 82 69 60 82Z";

/** "gracias": two cupped hands offering a heart. */
export function Thanks(props: IllustrationProps) {
  return (
    <ArtSvg {...props}>
      <TwoTone d={HEART} fill={ART.cardinal} shade={ART.fireAnt} offset={[8, 5]} />
      <Highlight x={32} y={30} width={9} height={16} rotate={-35} />
      {/* Each hand (the right one mirrors the left) points its fingers at the middle and tips up from the wrist. */}
      {(["left", "right"] as const).map((side) => (
        <g key={side} transform={side === "right" ? "translate(120 0) scale(-1 1)" : undefined}>
          <g transform="rotate(-24 61 100)">
            <rect x={40} y={70} width={12} height={22} rx={6} fill={SKIN_TONE.base} />
            <TwoTone
              d={roundedPolygon([[18, 84], [61, 84], [61, 108], [18, 108]], [4, 12, 12, 4])}
              fill={SKIN_TONE.base}
              shade={SKIN_TONE.shade}
              offset={[0, -4]}
            />
            <path d="M52 92H58M52 99H58" stroke={SKIN_TONE.shade} strokeWidth={2.5} strokeLinecap="round" />
            <TwoTone d={roundedPolygon([[0, 81], [22, 81], [22, 111], [0, 111]], 6)} fill={ART.beetle} shade={ART.beetleShade} offset={[0, -5]} />
          </g>
        </g>
      ))}
    </ArtSvg>
  );
}
