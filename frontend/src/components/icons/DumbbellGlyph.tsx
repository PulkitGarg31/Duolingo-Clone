import { SvgIcon, type IconProps } from "./Icon";

/** Path glyph for practice: the tilted dumbbell of the Practice icon in one colour (`currentColor`). */
export function DumbbellGlyph(props: IconProps) {
  return (
    <SvgIcon box={[32, 32]} {...props}>
      <g transform="rotate(-30 16 16)" fill="currentColor">
        <rect x={11} y={14.6} width={10} height={2.8} rx={1.4} />
        <rect x={3.2} y={11.5} width={3.6} height={9} rx={1.8} />
        <rect x={7.6} y={9} width={4.8} height={14} rx={2.4} />
        <rect x={19.6} y={9} width={4.8} height={14} rx={2.4} />
        <rect x={25.2} y={11.5} width={3.6} height={9} rx={1.8} />
      </g>
    </SvgIcon>
  );
}
