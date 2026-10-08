import { SvgIcon, type IconProps } from "./Icon";

/** Correct: a bold check with 8-unit round strokes on a 41 × 31 artboard (`currentColor`). */
export function CheckIcon(props: IconProps) {
  return (
    <SvgIcon box={[41, 31]} {...props}>
      <path
        d="M4 16 15 27 37 4"
        fill="none"
        stroke="currentColor"
        strokeWidth={8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </SvgIcon>
  );
}
