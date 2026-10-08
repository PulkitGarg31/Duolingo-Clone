import { SvgIcon, type IconProps } from "./Icon";
import { ART, GREY } from "./palette";
import { GemShape, Sparkle } from "./parts";

/** `inactive` is the grey gem shown next to a balance of 0. */
export type GemVariant = "active" | "inactive";

/** Gems: a blue faceted gem with a white sparkle. */
export function GemIcon({ variant = "active", ...props }: IconProps & { variant?: GemVariant }) {
  const active = variant === "active";
  return (
    <SvgIcon box={[32, 32]} {...props}>
      <GemShape
        cx={16}
        cy={16}
        r={13.4}
        colors={
          active
            ? { base: ART.macaw, light: ART.blueJay, shade: ART.whale }
            : { base: GREY.base, light: GREY.mid, shade: GREY.lip }
        }
      />
      {active ? <Sparkle cx={10.2} cy={10.4} r={3.4} color={ART.white} /> : null}
    </SvgIcon>
  );
}
