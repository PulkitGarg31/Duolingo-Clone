import { LINE, SvgIcon, type IconProps } from "./Icon";

/** Timed practice: a stopwatch with a top button, a side button and one hand (`currentColor`). */
export function StopwatchIcon(props: IconProps) {
  return (
    <SvgIcon box={[24, 24]} {...props}>
      <circle cx={12} cy={13.6} r={7.8} {...LINE} />
      <path d="M12 5.8V3.2M9.4 3H14.6M18.1 7.5 19.4 6.2M12 13.6V9.6" {...LINE} />
    </SvgIcon>
  );
}
