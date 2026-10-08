import { roundedPolygon } from "./geometry";
import { ART, HAIR, SKIN } from "./palette";
import { ArtSvg, Highlight, TwoTone, type IllustrationProps } from "./parts";
import { Bust, PORTRAIT } from "./people";

/** "el hombre": a man with short dark hair, a beard and a collared shirt. */
export function Man(props: IllustrationProps) {
  return (
    <ArtSvg {...props}>
      <Bust
        frame={PORTRAIT.adult}
        skin={SKIN.brown}
        shirt={ART.humpback}
        shirtShade={ART.narwhal}
        blush={false}
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
            {/* A short beard along the jaw, leaving the mouth on bare skin. */}
            <path d="M34 50C35 68 46 78 60 78C74 78 85 68 86 50C82 60 73 67 60 67C47 67 38 60 34 50Z" fill={HAIR.dark.base} />
          </>
        }
      />
    </ArtSvg>
  );
}
