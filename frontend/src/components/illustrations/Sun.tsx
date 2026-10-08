import { circlePath } from "./geometry";
import { ART } from "./palette";
import { ArtSvg, Clipped, GroundShadow, Highlight, TwoTone, type IllustrationProps } from "./parts";

const BADGE = circlePath(60, 56, 48);

/** "buenos días": the sun rising over a green hill in a morning sky. */
export function Sun(props: IllustrationProps) {
  return (
    <ArtSvg {...props}>
      <GroundShadow cx={60} y={101} width={66} />
      <path d={BADGE} fill={ART.blueJay} />
      <Clipped d={BADGE}>
        <g fill={ART.bee}>
          {Array.from({ length: 8 }, (_, index) => (
            <rect key={index} x={57} y={14} width={6} height={13} rx={3} transform={`rotate(${index * 45} 60 52)`} />
          ))}
        </g>
        <TwoTone d={circlePath(60, 52, 17)} fill={ART.bee} shade={ART.lion} offset={[4, 3]} />
        <Highlight x={49} y={41} width={6} height={10} rotate={30} />
        <g fill={ART.white}>
          <circle cx={80} cy={32} r={6} />
          <circle cx={88} cy={29} r={8} />
          <rect x={76} y={30} width={20} height={8} rx={4} />
        </g>
        <TwoTone d="M8 84Q60 58 112 84V112H8Z" fill={ART.owl} shade={ART.treeFrog} offset={[0, -6]} />
      </Clipped>
    </ArtSvg>
  );
}
