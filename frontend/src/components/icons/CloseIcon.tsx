import { LINE, SvgIcon, type IconProps } from "./Icon";

/** Close (quit lesson, dismiss): two crossing 3-unit strokes with round ends (`currentColor`). */
export function CloseIcon(props: IconProps) {
  return (
    <SvgIcon box={[24, 24]} {...props}>
      <path d="M4.5 4.5 19.5 19.5M19.5 4.5 4.5 19.5" {...LINE} strokeWidth={3} />
    </SvgIcon>
  );
}
