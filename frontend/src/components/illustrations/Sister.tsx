import { ART, HAIR, SKIN } from "./palette";
import { ArtSvg, Highlight, TwoTone, type IllustrationProps } from "./parts";
import { Bust, PORTRAIT } from "./people";

/** "la hermana": a teenage girl with a high ponytail and a yellow top. */
export function Sister(props: IllustrationProps) {
  return (
    <ArtSvg {...props}>
      <Bust
        frame={PORTRAIT.teen}
        skin={SKIN.brown}
        shirt={ART.bee}
        shirtShade={ART.camel}
        behind={
          <path
            d="M75.6 28.8C99 26.2 110.7 47 104.2 70.4C101.6 78.2 93.8 78.2 93.8 70.4C96.4 54.8 91.2 41.8 75.6 39.2Z"
            fill={HAIR.dark.base}
          />
        }
        clothes={<path d="M52 81.5Q60 89 68 81.5" fill="none" stroke={ART.camel} strokeWidth={3.5} strokeLinecap="round" />}
        hair={
          <>
            <TwoTone
              d="M34 48.3C31.4 24.9 45.7 18.4 60 18.4C75.6 18.4 88.6 26.2 86 48.3C83.4 37.9 75.6 31.4 62.6 31.4C52.2 30.1 41.8 36.6 34 48.3Z"
              fill={HAIR.dark.base}
              shade={HAIR.dark.shade}
              offset={[7, 0]}
            />
            <circle cx={80.8} cy={27.5} r={5.8} fill={ART.beetle} />
            <Highlight x={40.5} y={23.6} width={11.7} height={6.5} rotate={-26} />
          </>
        }
      />
    </ArtSvg>
  );
}
