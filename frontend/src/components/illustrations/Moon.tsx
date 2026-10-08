import { circlePath } from "./geometry";
import { ART } from "./palette";
import { ArtSvg, Clipped, GroundShadow, type IllustrationProps } from "./parts";

const BADGE = circlePath(60, 56, 48);
/** A rounded four-point star of radius 10 around (0, 0). */
const STAR = "M0 -10C1.6 -3.2 3.2 -1.6 10 0C3.2 1.6 1.6 3.2 0 10C-1.6 3.2 -3.2 1.6 -10 0C-3.2 -1.6 -1.6 -3.2 0 -10Z";

/** "buenas noches": a crescent moon and stars over a hill in the night sky. */
export function Moon(props: IllustrationProps) {
  const stars = [
    { x: 32, y: 40, scale: 0.75 },
    { x: 46, y: 24, scale: 0.5 },
    { x: 92, y: 66, scale: 0.45 },
  ];
  return (
    <ArtSvg {...props}>
      <GroundShadow cx={60} y={101} width={66} />
      <path d={BADGE} fill={ART.narwhal} />
      <Clipped d={BADGE}>
        {/* The crescent: a gold disc with a sky-coloured disc over its upper left. */}
        <circle cx={68} cy={46} r={19} fill={ART.bee} />
        <circle cx={76} cy={52} r={13} fill={ART.lion} />
        <circle cx={59} cy={39} r={16} fill={ART.narwhal} />
        <g fill={ART.white}>
          {stars.map(({ x, y, scale }) => (
            <path key={`${x}-${y}`} d={STAR} transform={`translate(${x} ${y}) scale(${scale})`} stroke={ART.white} strokeWidth={2} strokeLinejoin="round" />
          ))}
          <circle cx={28} cy={60} r={2} />
          <circle cx={88} cy={26} r={2} />
        </g>
        <path d="M8 86Q60 62 112 86V112H8Z" fill={ART.humpback} />
      </Clipped>
    </ArtSvg>
  );
}
