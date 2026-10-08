import { SvgIcon, type IconProps } from "./Icon";
import { ART, GREY } from "./palette";
import { FLAME, FLAME_CORE, FLAME_HIGHLIGHT } from "./shapes";

/**
 * `active`: the streak was extended today · `inactive`: not yet today (follows the theme's greys) ·
 * `perfect`: a perfect streak week · `frozen`: a Streak Freeze covered the day ·
 * `mono`: one colour (`currentColor`) for small labels such as "5 IN A ROW".
 */
export type FlameVariant = "active" | "inactive" | "perfect" | "frozen" | "mono";

const COLOURS: Record<FlameVariant, { outer: string; core: string; coreOpacity?: number; highlight: boolean }> = {
  active: { outer: ART.fox, core: ART.bee, highlight: true },
  inactive: { outer: GREY.base, core: GREY.mid, highlight: false },
  perfect: { outer: ART.bee, core: ART.canary, highlight: true },
  frozen: { outer: ART.blueJay, core: ART.iguana, highlight: true },
  mono: { outer: "currentColor", core: ART.white, coreOpacity: 0.4, highlight: false },
};

/** The streak flame: a round-bottomed flame with a smaller lick on its left, an inner drop and a highlight. */
export function FlameIcon({ variant = "active", ...props }: IconProps & { variant?: FlameVariant }) {
  const { outer, core, coreOpacity, highlight } = COLOURS[variant];
  return (
    <SvgIcon box={[32, 32]} {...props}>
      <path d={FLAME} fill={outer} />
      <path d={FLAME_CORE} fill={core} fillOpacity={coreOpacity} />
      {highlight ? (
        <path
          d={FLAME_HIGHLIGHT}
          fill="none"
          stroke={ART.white}
          strokeOpacity={0.6}
          strokeWidth={2.2}
          strokeLinecap="round"
        />
      ) : null}
      {/* a frozen flame grows a small icicle at its base */}
      {variant === "frozen" ? <path d="M19.8 27H22.6V29.4A1.4 1.4 0 0 1 19.8 29.4Z" fill={ART.macaw} /> : null}
    </SvgIcon>
  );
}
