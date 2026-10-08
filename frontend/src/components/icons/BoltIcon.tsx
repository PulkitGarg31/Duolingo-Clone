import { useId } from "react";
import { SvgIcon, type IconProps } from "./Icon";
import { ART } from "./palette";
import { BOLT, BOLT_LEFT_HALF } from "./shapes";

/** XP: a chunky lightning bolt, its right half in the darker gold. */
export function BoltIcon(props: IconProps) {
  const clip = useId();
  return (
    <SvgIcon box={[32, 32]} {...props}>
      <defs>
        <clipPath id={clip}>
          <path d={BOLT_LEFT_HALF} />
        </clipPath>
      </defs>
      <path d={BOLT} fill={ART.camel} />
      <path d={BOLT} fill={ART.bee} clipPath={`url(#${clip})`} />
    </SvgIcon>
  );
}
