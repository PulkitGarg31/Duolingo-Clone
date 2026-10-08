import { SvgIcon, type IconProps } from "./Icon";
import { ART, HIGHLIGHT } from "./palette";
import { GemShape, Sparkle } from "./parts";

const GEM = { base: ART.macaw, light: ART.blueJay, shade: ART.whale };
const BOWL = "M4.5 21H35.5C35.5 29.6 28.6 36 20 36C11.4 36 4.5 29.6 4.5 21Z";
// The lower part of the bowl in shade.
const BOWL_SHADE = "M6.4 28.4H33.6C31.1 32.9 26 36 20 36C14 36 8.9 32.9 6.4 28.4Z";

/** A wooden bowl heaped with gems (the middle gem pack). */
export function GemBowlIcon(props: IconProps) {
  return (
    <SvgIcon box={[40, 40]} {...props}>
      <GemShape cx={12.6} cy={18} r={6.2} colors={GEM} />
      <GemShape cx={27.4} cy={18} r={6.2} colors={GEM} />
      <GemShape cx={20} cy={14.2} r={6.8} colors={GEM} />
      <path d={BOWL} fill={ART.wood} />
      <path d={BOWL_SHADE} fill={ART.woodLip} />
      <rect x={3.5} y={19.4} width={33} height={4.4} rx={2.2} fill={ART.woodLip} />
      <path
        d="M9.4 26.6C10.4 28.6 12 30.2 14 31.2"
        fill="none"
        stroke={HIGHLIGHT.color}
        strokeOpacity={HIGHLIGHT.opacity}
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Sparkle cx={17.6} cy={11.2} r={2.6} color={ART.white} />
    </SvgIcon>
  );
}
