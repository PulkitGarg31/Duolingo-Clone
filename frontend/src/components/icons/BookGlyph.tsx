import { SvgIcon, type IconProps } from "./Icon";

// Two pages that curve down towards the spine, with a gap between them.
const LEFT_PAGE =
  "M15 7.6C12.4 5.8 8.6 5 4.4 5.5C3.6 5.6 3 6.3 3 7.1V23.2C3 24.1 3.8 24.7 4.6 24.6" +
  "C8.6 24.2 12.2 25.1 15 26.9Z";
const RIGHT_PAGE =
  "M17 7.6C19.6 5.8 23.4 5 27.6 5.5C28.4 5.6 29 6.3 29 7.1V23.2C29 24.1 28.2 24.7 27.4 24.6" +
  "C23.4 24.2 19.8 25.1 17 26.9Z";

/** Path glyph for stories (and the "lessons" quest): an open book with two rounded pages (`currentColor`). */
export function BookGlyph(props: IconProps) {
  return (
    <SvgIcon box={[32, 32]} {...props}>
      <g fill="currentColor" stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round">
        <path d={LEFT_PAGE} />
        <path d={RIGHT_PAGE} />
      </g>
    </SvgIcon>
  );
}
