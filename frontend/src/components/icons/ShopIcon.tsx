import { SvgIcon, type IconProps } from "./Icon";
import { ART, HIGHLIGHT } from "./palette";

const STRIPE_WIDTH = 6.5;
const STRIPES = [0, 1, 2, 3].map((i) => ({ x: 3 + i * STRIPE_WIDTH, fill: i % 2 === 0 ? ART.cardinal : ART.white }));

/** One awning stripe ending in a round scallop. */
const stripePath = (x: number) =>
  `M${x} 5H${x + STRIPE_WIDTH}V10.6A${STRIPE_WIDTH / 2} ${STRIPE_WIDTH / 2} 0 0 1 ${x} 10.6Z`;

/** Shop (nav): a market stall, a red and white scalloped awning on two posts over a gold counter. */
export function ShopIcon(props: IconProps) {
  return (
    <SvgIcon box={[32, 32]} {...props}>
      <rect x={6.4} y={10} width={2.4} height={10.5} fill={ART.woodLip} />
      <rect x={23.2} y={10} width={2.4} height={10.5} fill={ART.woodLip} />
      <rect x={5} y={21} width={22} height={8} rx={2.4} fill={ART.wood} />
      <path d="M5 25.6H27V26.6A2.4 2.4 0 0 1 24.6 29H7.4A2.4 2.4 0 0 1 5 26.6Z" fill={ART.woodLip} />
      <rect x={3.5} y={19} width={25} height={3.6} rx={1.8} fill={ART.bee} />
      {/* a darker copy of every stripe peeks out below it: a red hem that also outlines the white scallops */}
      {STRIPES.map(({ x }) => (
        <path key={`hem-${x}`} d={stripePath(x)} fill={ART.fireAnt} transform="translate(0 1.4)" />
      ))}
      {STRIPES.map(({ x, fill }) => (
        <path key={x} d={stripePath(x)} fill={fill} />
      ))}
      <rect x={2.5} y={3} width={27} height={3.6} rx={1.8} fill={ART.cardinal} />
      <path
        d="M5.2 4.8H9.2"
        stroke={HIGHLIGHT.color}
        strokeOpacity={HIGHLIGHT.opacity}
        strokeWidth={1.4}
        strokeLinecap="round"
      />
    </SvgIcon>
  );
}
