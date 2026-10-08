import { useId } from "react";
import { shieldPath } from "./geometry";
import { SvgIcon, type IconProps } from "./Icon";
import { ART } from "./palette";

const SHIELD = shieldPath(5, 3, 22, 26, 3.5);

/** Leaderboards (nav): a gold shield, light above and darker below, crossed by one diagonal gloss band. */
export function LeaderboardsIcon(props: IconProps) {
  const clip = useId();
  return (
    <SvgIcon box={[32, 32]} {...props}>
      <defs>
        <clipPath id={clip}>
          <path d={SHIELD} />
        </clipPath>
      </defs>
      <path d={SHIELD} fill={ART.camel} />
      <g clipPath={`url(#${clip})`}>
        <rect width={32} height={16} fill={ART.bee} />
        <path d="M21 0H28L10 32H3Z" fill={ART.white} fillOpacity={0.3} />
      </g>
    </SvgIcon>
  );
}
