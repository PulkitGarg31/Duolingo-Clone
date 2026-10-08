import { LINE, SvgIcon, type IconProps } from "./Icon";

// The cloth waves along its top and bottom edges and stays open at the pole.
const FLAG =
  "M5 4.5C7.5 3.2 9.8 3.3 12 4.4C14.2 5.5 16.5 5.6 19 4.4V13.4C16.5 14.6 14.2 14.5 12 13.4" +
  "C9.8 12.3 7.5 12.2 5 13.5";

/** Report a problem: a waving flag on a pole (`currentColor`). */
export function ReportFlagIcon(props: IconProps) {
  return (
    <SvgIcon box={[24, 24]} {...props}>
      <path d="M5 21.5V3.5" {...LINE} />
      <path d={FLAG} {...LINE} />
    </SvgIcon>
  );
}
