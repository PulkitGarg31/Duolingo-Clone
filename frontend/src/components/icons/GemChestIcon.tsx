import { SvgIcon, type IconProps } from "./Icon";
import { ART } from "./palette";
import { ChestArt, GemShape, Sparkle } from "./parts";

const GEM = { base: ART.macaw, light: ART.blueJay, shade: ART.whale };

/** An open chest overflowing with gems (quest rewards and the largest gem pack). */
export function GemChestIcon(props: IconProps) {
  return (
    <SvgIcon box={[40, 40]} {...props}>
      <g transform="translate(4 6)">
        <ChestArt
          variant="open"
          contents={
            <>
              <GemShape cx={10.4} cy={13.2} r={4.6} colors={GEM} />
              <GemShape cx={21.6} cy={13.2} r={4.6} colors={GEM} />
              <GemShape cx={16} cy={11} r={5} colors={GEM} />
            </>
          }
        />
      </g>
      <GemShape cx={6.2} cy={33.4} r={4.4} colors={GEM} />
      <GemShape cx={33.8} cy={33.4} r={4.4} colors={GEM} />
      <Sparkle cx={16.2} cy={12.6} r={2.4} color={ART.white} />
    </SvgIcon>
  );
}
