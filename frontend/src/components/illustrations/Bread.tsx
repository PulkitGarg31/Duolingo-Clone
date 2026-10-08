import { ART } from "./palette";
import { ArtSvg, GroundShadow, Highlight, TwoTone, type IllustrationProps } from "./parts";

/** "el pan": a round loaf with three scored cuts. */
export function Bread(props: IllustrationProps) {
  return (
    <ArtSvg {...props}>
      <GroundShadow cx={60} y={98} width={94} />
      <TwoTone d="M12 88C12 56 34 38 60 38C86 38 108 56 108 88Q108 102 96 102H24Q12 102 12 88Z" fill={ART.crust} shade={ART.wood} offset={[10, 6]} />
      <g stroke={ART.canary} strokeWidth={6} strokeLinecap="round">
        <path d="M38 60L47 76" />
        <path d="M56 53L65 72" />
        <path d="M75 56L82 70" />
      </g>
      <Highlight x={22} y={60} width={7} height={16} rotate={28} />
    </ArtSvg>
  );
}
