import { SvgIcon, type IconProps } from "./Icon";

/** Path glyph for completed lessons: a thick check with round ends (`currentColor`). */
export function CheckGlyph(props: IconProps) {
  return (
    <SvgIcon box={[32, 32]} {...props}>
      <path
        d="M6.6 16.3 13.1 22.7 25.5 9.3"
        fill="none"
        stroke="currentColor"
        strokeWidth={7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </SvgIcon>
  );
}
