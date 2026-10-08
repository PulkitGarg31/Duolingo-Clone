import { SvgIcon, type IconProps } from "./Icon";

// The head is a circle with a small eye cut out by the even-odd rule.
const HEAD =
  "M23.4 12.6A2.8 2.8 0 1 1 17.8 12.6A2.8 2.8 0 1 1 23.4 12.6Z" +
  "M22.2 12A0.8 0.8 0 1 0 20.6 12A0.8 0.8 0 1 0 22.2 12Z";

/** Slow audio: a side-view turtle with a domed shell and a round head (`currentColor`). */
export function TurtleIcon(props: IconProps) {
  return (
    <SvgIcon box={[24, 24]} {...props}>
      <g fill="currentColor">
        <path d="M3.2 14.4C3.2 9.3 6.6 6 11 6C15.4 6 18.8 9.3 18.8 14.4Z" />
        <rect x={1.8} y={15.3} width={18.4} height={2.4} rx={1.2} />
        <rect x={4.2} y={16.4} width={3.2} height={4.2} rx={1.6} />
        <rect x={14.4} y={16.4} width={3.2} height={4.2} rx={1.6} />
        <rect x={17.2} y={12.6} width={3.6} height={3.4} rx={1.2} />
        <path d={HEAD} fillRule="evenodd" />
      </g>
    </SvgIcon>
  );
}
