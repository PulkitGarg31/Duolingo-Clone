import { SvgIcon, type IconProps } from "./Icon";

// The padlock body with its keyhole (a dot over a slot) cut out by the even-odd rule.
const BODY =
  "M9 13.2H23A4 4 0 0 1 27 17.2V25.4A4 4 0 0 1 23 29.4H9A4 4 0 0 1 5 25.4V17.2A4 4 0 0 1 9 13.2Z" +
  "M14.9 21.7A2.4 2.4 0 1 1 17.1 21.7V24A1.1 1.1 0 0 1 14.9 24Z";

/** Path glyph for locked lessons: a rounded padlock with a keyhole (`currentColor`). */
export function LockGlyph(props: IconProps) {
  return (
    <SvgIcon box={[32, 32]} {...props}>
      <path
        d="M10 14V10A6 6 0 0 1 22 10V14"
        fill="none"
        stroke="currentColor"
        strokeWidth={4}
        strokeLinecap="round"
      />
      <path d={BODY} fill="currentColor" fillRule="evenodd" />
    </SvgIcon>
  );
}
