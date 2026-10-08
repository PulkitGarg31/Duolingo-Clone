import { ART, HAIR, SKIN } from "./palette";
import { ArtSvg, Highlight, TwoTone, type IllustrationProps } from "./parts";
import { Bust, PORTRAIT } from "./people";

/** "el niño": a young boy with a ginger tuft and a blue T-shirt. */
export function Boy(props: IllustrationProps) {
  return (
    <ArtSvg {...props}>
      <Bust
        frame={PORTRAIT.child}
        skin={SKIN.light}
        shirt={ART.macaw}
        shirtShade={ART.whale}
        mouth="grin"
        clothes={<path d="M52 84.5Q60 92 68 84.5" fill="none" stroke={ART.whale} strokeWidth={3.5} strokeLinecap="round" />}
        hair={
          <>
            <TwoTone
              d="M34 48.8C32.8 27.7 45.1 20.3 60 20.3C74.9 20.3 87.2 27.7 86 48.8C81 38.9 72.4 35.1 62.5 36.4C53.8 33.9 42.7 37.6 34 48.8Z"
              fill={HAIR.ginger.base}
              shade={HAIR.ginger.shade}
              offset={[7, 0]}
            />
            <path d="M55 24C56.3 11.6 68.7 6.7 77.3 11.6C68.7 14.1 65 19 65 26.5Z" fill={HAIR.ginger.base} />
            <Highlight x={40.2} y={25.2} width={11.1} height={6.2} rotate={-28} />
          </>
        }
      />
    </ArtSvg>
  );
}
