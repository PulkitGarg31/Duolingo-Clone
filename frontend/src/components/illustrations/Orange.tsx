import { circlePath } from "./geometry";
import { ART } from "./palette";
import { ArtSvg, GroundShadow, Highlight, TwoTone, type IllustrationProps } from "./parts";

/** "la naranja": a round orange with a dimpled peel and a leaf. */
export function Orange(props: IllustrationProps) {
  const dimples = [
    [48, 54],
    [72, 48],
    [80, 72],
    [56, 82],
    [64, 64],
    [40, 72],
  ];
  return (
    <ArtSvg {...props}>
      <GroundShadow cx={60} y={100} width={68} />
      <TwoTone d={circlePath(60, 64, 38)} fill={ART.fox} shade={ART.foxShade} offset={[8, 6]} />
      <g fill={ART.foxShade}>
        {dimples.map(([cx, cy]) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={1.8} />
        ))}
      </g>
      <rect x={56.5} y={22} width={7} height={9} rx={3} fill={ART.woodShade} />
      <TwoTone d="M62 27C66 15 80 11 91 14C87 25 75 32 62 27Z" fill={ART.owl} shade={ART.owlShade} offset={[0, -4]} />
      <Highlight x={34} y={42} width={9} height={20} rotate={30} />
    </ArtSvg>
  );
}
