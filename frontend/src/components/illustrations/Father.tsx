import { roundedPolygon } from "./geometry";
import { ART, HAIR, SKIN } from "./palette";
import { ArtSvg, Highlight, TwoTone, type IllustrationProps } from "./parts";
import { Baby, Bust, PORTRAIT } from "./people";

const SKIN_TONE = SKIN.deep;

/** "el padre": a father with a moustache, holding his baby. */
export function Father(props: IllustrationProps) {
  return (
    <ArtSvg {...props}>
      <Bust
        frame={PORTRAIT.adult}
        skin={SKIN_TONE}
        shirt={ART.peacock}
        shirtShade={ART.peacockShade}
        clothes={
          <g fill={ART.white}>
            <path d={roundedPolygon([[46, 78], [60, 86], [50, 95]], 2)} />
            <path d={roundedPolygon([[74, 78], [60, 86], [70, 95]], 2)} />
          </g>
        }
        hair={
          <>
            <TwoTone
              d="M33 45C31.7 21.9 44.6 14.1 60 14.1C76.7 14.1 88.3 21.9 87 45C83.1 34.7 75.4 29.6 65.1 30.9C54.9 27 42 32.1 33 45Z"
              fill={HAIR.dark.base}
              shade={HAIR.dark.shade}
              offset={[7, 0]}
            />
            <Highlight x={40.7} y={19.3} width={12.9} height={6.4} rotate={-24} />
          </>
        }
        front={
          <>
            <path d="M48.4 56.6Q60 50.1 71.6 56.6Q60 58.5 48.4 56.6Z" fill={HAIR.dark.base} />
            <Baby cx={84} cy={88} blanket={ART.bee} blanketShade={ART.camel} />
            <path d={roundedPolygon([[56, 94], [72, 98], [70, 108], [54, 104]], 5)} fill={SKIN_TONE.base} />
          </>
        }
      />
    </ArtSvg>
  );
}
