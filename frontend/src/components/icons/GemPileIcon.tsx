import { SvgIcon, type IconProps } from "./Icon";
import { ART } from "./palette";
import { GemShape, Sparkle } from "./parts";

const GEM = { base: ART.macaw, light: ART.blueJay, shade: ART.whale };
// Back to front: the top gem first, so the rows below overlap it.
const PILE = [
  [20, 12.4],
  [14.3, 21.4],
  [25.7, 21.4],
  [8.6, 30.4],
  [20, 30.4],
  [31.4, 30.4],
] as const;

/** A heap of six gems (the gems popover and the smallest gem pack). */
export function GemPileIcon(props: IconProps) {
  return (
    <SvgIcon box={[40, 40]} {...props}>
      {PILE.map(([cx, cy]) => (
        <GemShape key={`${cx}-${cy}`} cx={cx} cy={cy} r={6.6} colors={GEM} />
      ))}
      <Sparkle cx={17.4} cy={9.6} r={2.6} color={ART.white} />
    </SvgIcon>
  );
}
