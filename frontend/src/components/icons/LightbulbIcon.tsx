import { SvgIcon, type IconProps } from "./Icon";
import { ART } from "./palette";

const BULB =
  "M12 2.6C16.2 2.6 19.4 5.8 19.4 9.8C19.4 12.5 18 14.3 16.6 15.6C15.9 16.3 15.6 16.9 15.6 17.6H8.4" +
  "C8.4 16.9 8.1 16.3 7.4 15.6C6 14.3 4.6 12.5 4.6 9.8C4.6 5.8 7.8 2.6 12 2.6Z";
const BULB_SHADE =
  "M15.2 3.4C17.7 4.6 19.4 7 19.4 9.8C19.4 12.5 18 14.3 16.6 15.6C15.9 16.3 15.6 16.9 15.6 17.6H13.4" +
  "C13.4 16.4 14 15.4 14.9 14.5C16.3 13.1 17.4 11.6 17.4 9.4C17.4 6.9 16.6 4.8 15.2 3.4Z";

/** Tip: a round gold bulb on a grey screw base. */
export function LightbulbIcon(props: IconProps) {
  return (
    <SvgIcon box={[24, 24]} {...props}>
      <path d={BULB} fill={ART.bee} />
      <path d={BULB_SHADE} fill={ART.camel} />
      <rect x={8.6} y={18.4} width={6.8} height={2} rx={1} fill={ART.hare} />
      <rect x={9.4} y={21} width={5.2} height={1.8} rx={0.9} fill={ART.hare} />
      <path
        d="M8 8.6C8.3 7.2 9.2 6.1 10.4 5.5"
        fill="none"
        stroke={ART.white}
        strokeOpacity={0.6}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
    </SvgIcon>
  );
}
