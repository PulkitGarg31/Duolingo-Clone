import { ART } from "./palette";
import { ArtSvg, GroundShadow, Highlight, TwoTone, type IllustrationProps } from "./parts";

/** "el té": a teal teapot with steam rising from its spout. */
export function Tea(props: IllustrationProps) {
  return (
    <ArtSvg {...props}>
      <GroundShadow cx={60} y={100} width={84} />
      <g fill="none" stroke={ART.hare} strokeWidth={4.5} strokeLinecap="round">
        <path d="M10 50C6 44 14 40 10 33" />
        <path d="M21 46C17 40 25 36 21 29" />
      </g>
      <circle cx={95} cy={72} r={13} fill="none" stroke={ART.peacockShade} strokeWidth={8} />
      <path d="M32 86C22 86 15 77 12 66Q11 60 16 60Q19 60 21 65C24 72 29 75 36 75Z" fill={ART.peacock} />
      <TwoTone d="M24 78C24 56 40 44 60 44C80 44 96 56 96 78C96 94 86 104 72 104H48C34 104 24 94 24 78Z" fill={ART.peacock} shade={ART.peacockShade} offset={[10, 4]} />
      <path d="M40 47C40 35 50 30 60 30C70 30 80 35 80 47Z" fill={ART.peacockShade} />
      <circle cx={60} cy={27} r={5.5} fill={ART.bee} />
      <Highlight x={33} y={58} width={8} height={18} rotate={28} />
    </ArtSvg>
  );
}
