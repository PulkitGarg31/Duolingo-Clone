import { SvgIcon, type IconProps } from "./Icon";
import { Sparkle } from "./parts";

/** New word: a four-point sparkle with soft tips (`currentColor`). */
export function SparkleIcon(props: IconProps) {
  return (
    <SvgIcon box={[24, 24]} {...props}>
      <Sparkle cx={12} cy={12} r={10} color="currentColor" />
    </SvgIcon>
  );
}
