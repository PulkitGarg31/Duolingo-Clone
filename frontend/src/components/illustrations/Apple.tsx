import { ART } from "./palette";
import { ArtSvg, GroundShadow, Highlight, TwoTone, type IllustrationProps } from "./parts";

/** "la manzana": a red apple with a stem and a leaf. */
export function Apple(props: IllustrationProps) {
  return (
    <ArtSvg {...props}>
      <GroundShadow cx={60} y={100} width={66} />
      <rect x={57} y={16} width={7} height={26} rx={3.5} fill={ART.woodShade} transform="rotate(10 60 40)" />
      <TwoTone d="M64 31C70 17 86 12 97 16C93 28 79 37 64 31Z" fill={ART.owl} shade={ART.owlShade} offset={[0, -4]} />
      <TwoTone
        d="M60 38C48 28 20 30 18 58C16 84 36 106 50 104C54 103.5 57 101 60 101C63 101 66 103.5 70 104C84 106 104 84 102 58C100 30 72 28 60 38Z"
        fill={ART.cardinal}
        shade={ART.fireAnt}
        offset={[9, 5]}
      />
      <Highlight x={30} y={46} width={9} height={20} rotate={24} />
    </ArtSvg>
  );
}
