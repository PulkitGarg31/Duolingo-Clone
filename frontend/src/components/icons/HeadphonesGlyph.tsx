import { SvgIcon, type IconProps } from "./Icon";

/** Path glyph for listening practice: a rounded headband with two ear cups (`currentColor`). */
export function HeadphonesGlyph(props: IconProps) {
  return (
    <SvgIcon box={[32, 32]} {...props}>
      <path
        d="M5 19.5V15.6A11 11 0 0 1 27 15.6V19.5"
        fill="none"
        stroke="currentColor"
        strokeWidth={3.6}
        strokeLinecap="round"
      />
      <rect x={2.6} y={16.6} width={7} height={12} rx={3.5} fill="currentColor" />
      <rect x={22.4} y={16.6} width={7} height={12} rx={3.5} fill="currentColor" />
    </SvgIcon>
  );
}
