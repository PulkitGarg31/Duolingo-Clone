import { roundedPolygon } from "./geometry";
import { ART, HAIR, SKIN } from "./palette";
import { ArtSvg, Highlight, TwoTone, type IllustrationProps } from "./parts";
import { Bust, PORTRAIT } from "./people";

/** "la niña": a young girl with pigtails and a pink dress. */
export function Girl(props: IllustrationProps) {
  return (
    <ArtSvg {...props}>
      <Bust
        frame={PORTRAIT.child}
        skin={SKIN.tan}
        shirt={ART.starfish}
        shirtShade={ART.starfishShade}
        behind={
          <g fill={HAIR.brown.base}>
            <circle cx={27.8} cy={47.5} r={13.6} />
            <circle cx={92.2} cy={47.5} r={13.6} />
          </g>
        }
        clothes={
          <g fill={ART.white}>
            <path d={roundedPolygon([[49, 83], [60, 88], [52, 95]], 2)} />
            <path d={roundedPolygon([[71, 83], [60, 88], [68, 95]], 2)} />
          </g>
        }
        hair={
          <>
            <TwoTone
              d="M34 48.8C32.8 27.7 45.1 20.3 60 20.3C74.9 20.3 87.2 27.7 86 48.8C83.5 38.9 77.3 33.9 69.9 35.1H50.1C42.7 33.9 36.5 38.9 34 48.8Z"
              fill={HAIR.brown.base}
              shade={HAIR.brown.shade}
              offset={[7, 0]}
            />
            <g fill={ART.cardinal}>
              <circle cx={36.5} cy={41.3} r={5} />
              <circle cx={83.5} cy={41.3} r={5} />
            </g>
            <Highlight x={41.4} y={25.2} width={11.1} height={6.2} rotate={-28} />
          </>
        }
      />
    </ArtSvg>
  );
}
