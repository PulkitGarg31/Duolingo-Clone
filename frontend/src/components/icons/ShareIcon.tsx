import { LINE, SvgIcon, type IconProps } from "./Icon";

// An open-topped box: the gap leaves room for the arrow.
const BOX =
  "M8.5 10H7.4C6.1 10 5 11.1 5 12.4V18.6C5 19.9 6.1 21 7.4 21H16.6C17.9 21 19 19.9 19 18.6V12.4" +
  "C19 11.1 17.9 10 16.6 10H15.5";

/** Share: an arrow rising out of an open box (`currentColor`). */
export function ShareIcon(props: IconProps) {
  return (
    <SvgIcon box={[24, 24]} {...props}>
      <path d="M12 14V3.8M8.2 7.4 12 3.6 15.8 7.4" {...LINE} />
      <path d={BOX} {...LINE} />
    </SvgIcon>
  );
}
