import { SvgIcon, type IconProps } from "./Icon";
import { ART } from "./palette";
import { ChestArt, Sparkle, type ChestVariant } from "./parts";

export type { ChestVariant };

/**
 * A treasure chest. `closed`: a reward waiting to be claimed · `open`: claimed, lid back and empty but for two
 * glints · `locked`: out of reach, in the theme's greys.
 */
export function ChestIcon({ variant = "closed", ...props }: IconProps & { variant?: ChestVariant }) {
  return (
    <SvgIcon box={[32, 32]} {...props}>
      <ChestArt variant={variant} />
      {variant === "open" ? (
        <>
          <Sparkle cx={12.4} cy={9.6} r={2.4} color={ART.white} />
          <Sparkle cx={19.6} cy={8.6} r={1.7} color={ART.white} />
        </>
      ) : null}
    </SvgIcon>
  );
}
