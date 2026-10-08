import { LINE, SvgIcon, type IconProps } from "./Icon";

// A disc with an overlapping disc taken out of its upper right: the outer arc goes the long way round, the
// inner arc follows the second disc back.
const CRESCENT = "M20.09 14.05A8 8 0 1 1 10.95 4.91A6.8 6.8 0 0 0 20.09 14.05Z";

/** Dark theme: a crescent moon (`currentColor`). */
export function MoonIcon(props: IconProps) {
  return (
    <SvgIcon box={[24, 24]} {...props}>
      <path d={CRESCENT} {...LINE} />
    </SvgIcon>
  );
}
