import { roundedPolygon } from "./geometry";
import { ART, HAIR, type Skin } from "./palette";
import { GroundShadow, Highlight, TwoTone } from "./parts";
import { Face, Head } from "./people";

interface MeasuredPersonProps {
  /** Centre of the head: lower means shorter. */
  headY: number;
  /** Where the legs start. */
  hipY: number;
  skin: Skin;
}

/** A person standing beside a ruler, with a dashed line marking their height on it. */
export function MeasuredPerson({ headY, hipY, skin }: MeasuredPersonProps) {
  const cx = 72;
  const r = 12;
  const shoulderY = headY + r + 2;
  const ticks = Array.from({ length: 9 }, (_, index) => 18 + index * 10);
  return (
    <>
      <GroundShadow cx={58} y={102} width={88} />
      <TwoTone d={roundedPolygon([[13, 8], [29, 8], [29, 106], [13, 106]], 5)} fill={ART.bee} shade={ART.camel} offset={[5, 0]} />
      <g stroke={ART.camel} strokeWidth={2.5} strokeLinecap="round">
        {ticks.map((y, index) => (
          <path key={y} d={`M14 ${y}H${index % 2 === 0 ? 23 : 19}`} />
        ))}
      </g>
      <path d={`M33 ${headY - r - 2}H${cx - 18}`} stroke={ART.macaw} strokeWidth={3} strokeLinecap="round" strokeDasharray="2 6" />
      <g fill={ART.narwhal}>
        <rect x={cx - 10} y={hipY - 2} width={9} height={104 - hipY} rx={4.5} />
        <rect x={cx + 1} y={hipY - 2} width={9} height={104 - hipY} rx={4.5} />
      </g>
      <g fill={ART.eel}>
        <rect x={cx - 13} y={100} width={12} height={6} rx={3} />
        <rect x={cx + 1} y={100} width={12} height={6} rx={3} />
      </g>
      <g fill={ART.macaw}>
        <rect x={cx - 20} y={shoulderY + 1} width={8} height={hipY - shoulderY - 2} rx={4} />
        <rect x={cx + 12} y={shoulderY + 1} width={8} height={hipY - shoulderY - 2} rx={4} />
      </g>
      <g fill={skin.base}>
        <circle cx={cx - 16} cy={hipY - 1} r={4} />
        <circle cx={cx + 16} cy={hipY - 1} r={4} />
      </g>
      <TwoTone
        d={roundedPolygon([[cx - 13, shoulderY], [cx + 13, shoulderY], [cx + 13, hipY + 2], [cx - 13, hipY + 2]], 8)}
        fill={ART.macaw}
        shade={ART.whale}
        offset={[6, 0]}
      />
      <Head cx={cx} cy={headY} r={r} skin={skin} />
      <TwoTone
        d={`M${cx - r} ${headY}C${cx - r} ${headY - r * 1.35} ${cx + r} ${headY - r * 1.35} ${cx + r} ${headY}Q${cx} ${headY - r * 0.55} ${cx - r} ${headY}Z`}
        fill={HAIR.dark.base}
        shade={HAIR.dark.shade}
        offset={[3, 0]}
      />
      <Face cx={cx} cy={headY} r={r} skin={skin} />
      <Highlight x={cx - 7} y={headY - r - 1} width={5} height={3} rotate={-25} />
    </>
  );
}
