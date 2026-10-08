import { MeasuredPerson } from "./heightChart";
import { SKIN } from "./palette";
import { ArtSvg, type IllustrationProps } from "./parts";

/** "alto": a tall person reaching the top of the ruler. */
export function Tall(props: IllustrationProps) {
  return (
    <ArtSvg {...props}>
      <MeasuredPerson headY={24} hipY={70} skin={SKIN.tan} />
    </ArtSvg>
  );
}
