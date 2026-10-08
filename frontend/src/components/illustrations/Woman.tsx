import { roundedPolygon } from "./geometry";
import { ART, HAIR, SKIN } from "./palette";
import { ArtSvg, Highlight, TwoTone, type IllustrationProps } from "./parts";
import { Bust, PORTRAIT } from "./people";

/** "la mujer": a woman with long blond hair and a red top. */
export function Woman(props: IllustrationProps) {
  return (
    <ArtSvg {...props}>
      <Bust
        frame={PORTRAIT.adult}
        skin={SKIN.light}
        shirt={ART.cardinal}
        shirtShade={ART.fireAnt}
        behind={
          <path
            d="M25.3 50.1C22.7 19.3 40.7 7.7 60 7.7C79.3 7.7 97.3 19.3 94.7 50.1L99 92Q100 100 92 100H28Q20 100 21 92Z"
            fill={HAIR.blond.shade}
          />
        }
        clothes={<path d={roundedPolygon([[50, 80], [70, 80], [60, 94]], 3)} fill={SKIN.light.base} />}
        hair={
          <>
            <TwoTone
              d="M33 45C33 23.1 47.1 15.4 62.6 16.7C78 18 88.3 28.3 87 47.6C79.3 36 69 32.1 58.7 33.4C49.7 33.4 39.4 38.6 33 45Z"
              fill={HAIR.blond.base}
              shade={HAIR.blond.shade}
              offset={[6, 0]}
            />
            <Highlight x={40.7} y={20.6} width={12.9} height={6.4} rotate={-28} />
          </>
        }
        front={
          <g fill={ART.macaw}>
            <circle cx={33} cy={57.2} r={3.2} />
            <circle cx={87} cy={57.2} r={3.2} />
          </g>
        }
      />
    </ArtSvg>
  );
}
