import { SvgIcon, type IconProps } from "./Icon";

/** Incorrect: a bold ✗ with 8-unit round strokes on a 31 × 31 artboard (`currentColor`). */
export function CrossIcon(props: IconProps) {
  return (
    <SvgIcon box={[31, 31]} {...props}>
      <path d="M4 4 27 27M27 4 4 27" fill="none" stroke="currentColor" strokeWidth={8} strokeLinecap="round" />
    </SvgIcon>
  );
}
