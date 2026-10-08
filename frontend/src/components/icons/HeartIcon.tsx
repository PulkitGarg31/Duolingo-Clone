import { SvgIcon, type IconProps } from "./Icon";
import { ART, GREY } from "./palette";
import { HeartArt } from "./parts";

/** `empty` is a lost heart, drawn in the theme's greys. */
export type HeartVariant = "full" | "empty";

/** Hearts: a plump red heart with a darker lower-right shade and a pink highlight. */
export function HeartIcon({ variant = "full", ...props }: IconProps & { variant?: HeartVariant }) {
  return (
    <SvgIcon box={[32, 32]} {...props}>
      {variant === "full" ? (
        <HeartArt fill={ART.cardinal} shade={ART.fireAnt} highlight={ART.flamingo} />
      ) : (
        <HeartArt fill={GREY.base} shade={GREY.mid} />
      )}
    </SvgIcon>
  );
}
