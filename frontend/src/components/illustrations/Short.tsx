import { MeasuredPerson } from "./heightChart";
import { SKIN } from "./palette";
import { ArtSvg, type IllustrationProps } from "./parts";

/** "bajo": a short person beside the same ruler, reaching only partway up it. */
export function Short(props: IllustrationProps) {
  return (
    <ArtSvg {...props}>
      <MeasuredPerson headY={62} hipY={92} skin={SKIN.tan} />
    </ArtSvg>
  );
}
