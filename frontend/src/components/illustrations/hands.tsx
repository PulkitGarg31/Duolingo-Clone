import { roundedPolygon } from "./geometry";
import type { Skin } from "./palette";
import { TwoTone } from "./parts";

interface OpenHandProps {
  skin: Skin;
  /** Sleeve cuff colours. */
  cuff: string;
  cuffShade: string;
  /** Placement on the artboard, e.g. "rotate(-12 60 112)". */
  transform?: string;
}

/** An open hand with spread fingers above a sleeve cuff, as in a wave. Drawn wrist-down around x = 60. */
export function OpenHand({ skin, cuff, cuffShade, transform }: OpenHandProps) {
  return (
    <g transform={transform}>
      <g fill={skin.base}>
        <rect x={37} y={22} width={10} height={44} rx={5} />
        <rect x={49} y={12} width={10} height={54} rx={5} />
        <rect x={61} y={16} width={10} height={50} rx={5} />
        <rect x={73} y={28} width={10} height={38} rx={5} />
        <rect x={34.5} y={56} width={11} height={34} rx={5.5} transform="rotate(-40 40 90)" />
      </g>
      <TwoTone d={roundedPolygon([[36, 52], [84, 52], [84, 100], [36, 100]], 16)} fill={skin.base} shade={skin.shade} offset={[8, 0]} />
      <TwoTone d={roundedPolygon([[38, 96], [82, 96], [82, 114], [38, 114]], 6)} fill={cuff} shade={cuffShade} offset={[9, 0]} />
    </g>
  );
}
