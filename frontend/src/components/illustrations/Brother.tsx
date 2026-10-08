import { ART, HAIR, SKIN } from "./palette";
import { ArtSvg, Highlight, TwoTone, type IllustrationProps } from "./parts";
import { Bust, PORTRAIT } from "./people";

/** "el hermano": a teenage boy with a quiff, in an orange hoodie. */
export function Brother(props: IllustrationProps) {
  return (
    <ArtSvg {...props}>
      <Bust
        frame={PORTRAIT.teen}
        skin={SKIN.light}
        shirt={ART.fox}
        shirtShade={ART.foxShade}
        mouth="grin"
        clothes={
          <>
            <path d="M40 81Q60 96 80 81L84 89Q60 106 36 89Z" fill={ART.foxShade} />
            <g fill={ART.white}>
              <rect x={52.5} y={92} width={3.5} height={14} rx={1.75} />
              <rect x={64} y={92} width={3.5} height={14} rx={1.75} />
            </g>
          </>
        }
        hair={
          <>
            <TwoTone
              d="M34 47C32.7 24.9 45.7 18.4 60 18.4C75.6 18.4 87.3 26.2 86 47C82.1 37.9 74.3 32.7 63.9 34C53.5 31.4 43.1 36.6 34 47Z"
              fill={HAIR.dark.base}
              shade={HAIR.dark.shade}
              offset={[7, 0]}
            />
            <path d="M50.9 22.3C54.8 9.3 73 5.4 83.4 13.2C73 13.2 65.2 18.4 62.6 26.2Z" fill={HAIR.dark.base} />
            <Highlight x={40.5} y={23.6} width={11.7} height={6.5} rotate={-26} />
          </>
        }
      />
    </ArtSvg>
  );
}
