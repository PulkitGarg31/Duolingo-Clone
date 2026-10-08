import { roundedPolygon } from "./geometry";
import { ART, HAIR, SKIN } from "./palette";
import { ArtSvg, Highlight, TwoTone, type IllustrationProps } from "./parts";
import { Baby, Bust, PORTRAIT } from "./people";

const SKIN_TONE = SKIN.tan;

/** "la madre": a mother with her hair in a bun, holding her baby. */
export function Mother(props: IllustrationProps) {
  return (
    <ArtSvg {...props}>
      <Bust
        frame={PORTRAIT.adult}
        skin={SKIN_TONE}
        shirt={ART.beetle}
        shirtShade={ART.beetleShade}
        behind={<circle cx={60} cy={12.9} r={12.9} fill={HAIR.brown.shade} />}
        hair={
          <>
            <TwoTone
              d="M33 47.6C30.4 24.4 44.6 15.4 60 15.4C75.4 15.4 89.6 24.4 87 47.6C80.6 36 71.6 30.9 60 32.1C48.4 30.9 39.4 36 33 47.6Z"
              fill={HAIR.brown.base}
              shade={HAIR.brown.shade}
              offset={[7, 0]}
            />
            <Highlight x={40.7} y={20.6} width={12.9} height={6.4} rotate={-26} />
          </>
        }
        front={
          <>
            <Baby cx={36} cy={88} blanket={ART.blueJay} blanketShade={ART.macaw} />
            <path d={roundedPolygon([[48, 98], [64, 94], [66, 104], [50, 108]], 5)} fill={SKIN_TONE.base} />
          </>
        }
      />
    </ArtSvg>
  );
}
