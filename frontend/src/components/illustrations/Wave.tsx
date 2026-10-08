import { OpenHand } from "./hands";
import { ART, SKIN } from "./palette";
import { ArtSvg, type IllustrationProps } from "./parts";

/** "hola": a hand waving hello, with motion marks. */
export function Wave(props: IllustrationProps) {
  return (
    <ArtSvg {...props}>
      <OpenHand skin={SKIN.light} cuff={ART.macaw} cuffShade={ART.whale} transform="translate(0 2) rotate(-12 60 112)" />
      <g fill="none" stroke={ART.macaw} strokeWidth={4.5} strokeLinecap="round">
        <path d="M96 20Q105 30 104 44" />
        <path d="M106 8Q119 24 116 46" />
        <path d="M22 26Q13 36 15 50" />
      </g>
    </ArtSvg>
  );
}
