import { SvgIcon, type IconProps } from "./Icon";
import { ART } from "./palette";
import { ChestArt, GemShape, Sparkle, type ChestVariant } from "./parts";

export type { ChestVariant };

const GEM = { base: ART.macaw, light: ART.blueJay, shade: ART.whale };

/**
 * A treasure chest. `closed`: a reward waiting to be claimed · `open`: claimed, its lid thrown back over two
 * glinting gems left inside · `locked`: out of reach, in the theme's greys.
 */
export function ChestIcon({ variant = "closed", ...props }: IconProps & { variant?: ChestVariant }) {
  const open = variant === "open";
  return (
    <SvgIcon box={[32, 32]} {...props}>
      <ChestArt
        variant={variant}
        contents={
          open ? (
            <>
              <GemShape cx={12.6} cy={12.4} r={3.5} colors={GEM} />
              <GemShape cx={19.6} cy={11.6} r={3.9} colors={GEM} />
            </>
          ) : null
        }
      />
      {open ? (
        <>
          <Sparkle cx={18.2} cy={9.6} r={2.1} color={ART.white} />
          <Sparkle cx={11.2} cy={10.6} r={1.3} color={ART.white} />
        </>
      ) : null}
    </SvgIcon>
  );
}
