import { circlePath, roundedPolygon } from "./geometry";
import { ART } from "./palette";
import { ArtSvg, GroundShadow, Highlight, TwoTone, type IllustrationProps } from "./parts";

/** A paper slip with a scalloped bottom edge (no sharp zig-zag). */
const RECEIPT =
  "M38 12H82Q86 12 86 16V92A4.5 4.5 0 0 1 77 92A4.5 4.5 0 0 1 68 92A4.5 4.5 0 0 1 59 92A4.5 4.5 0 0 1 50 92A4.5 4.5 0 0 1 41 92A4.5 4.5 0 0 1 34 92V16Q34 12 38 12Z";

/** "la cuenta": the bill on its folder, with a gold coin. */
export function Bill(props: IllustrationProps) {
  return (
    <ArtSvg {...props}>
      <GroundShadow cx={58} y={100} width={86} />
      <TwoTone d={roundedPolygon([[16, 28], [100, 28], [100, 104], [16, 104]], 8)} fill={ART.wood} shade={ART.woodShade} offset={[10, 0]} />
      <TwoTone d={RECEIPT} fill={ART.white} shade={ART.iguana} offset={[8, 0]} />
      <g stroke={ART.anchovy} strokeWidth={4} strokeLinecap="round">
        <path d="M42 26H74" />
        <path d="M42 38H66" />
        <path d="M42 50H74" />
        <path d="M42 62H62" />
      </g>
      <path d="M42 77H76" stroke={ART.macaw} strokeWidth={5} strokeLinecap="round" />
      <TwoTone d={circlePath(90, 88, 14)} fill={ART.bee} shade={ART.camel} offset={[4, 3]} />
      <circle cx={90} cy={88} r={8.5} fill="none" stroke={ART.lion} strokeWidth={3} />
      <Highlight x={20} y={34} width={5} height={14} />
    </ArtSvg>
  );
}
