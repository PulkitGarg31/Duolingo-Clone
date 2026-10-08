import { arcPath } from "./geometry";
import { LINE, SvgIcon, type IconProps } from "./Icon";

/** Previous mistake: two curved arrows chasing each other round a circle (`currentColor`). */
export function RefreshIcon(props: IconProps) {
  return (
    <SvgIcon box={[24, 24]} {...props}>
      {/* each arc ends in an arrowhead pointing clockwise; the lower pair is the upper pair turned half round */}
      <path d={arcPath(12, 12, 7, 200, 330)} {...LINE} />
      <path d="M14.3 7.1 18.1 8.5 18.8 4.6" {...LINE} />
      <path d={arcPath(12, 12, 7, 20, 150)} {...LINE} />
      <path d="M9.7 16.9 5.9 15.5 5.2 19.4" {...LINE} />
    </SvgIcon>
  );
}
