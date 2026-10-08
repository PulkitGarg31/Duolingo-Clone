import { SvgIcon, type IconProps } from "./Icon";
import { STAR } from "./shapes";

/** Path glyph for the current lesson and legendary nodes: a five-point star with soft points (`currentColor`). */
export function StarGlyph(props: IconProps) {
  return (
    <SvgIcon box={[32, 32]} {...props}>
      <path d={STAR} fill="currentColor" />
    </SvgIcon>
  );
}
