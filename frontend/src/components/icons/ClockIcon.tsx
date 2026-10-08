import { LINE, SvgIcon, type IconProps } from "./Icon";

/** Time left: a round clock face with one hand (`currentColor`). */
export function ClockIcon(props: IconProps) {
  return (
    <SvgIcon box={[24, 24]} {...props}>
      <circle cx={12} cy={12} r={8.8} {...LINE} />
      <path d="M12 7.4V12L15 14" {...LINE} />
    </SvgIcon>
  );
}
