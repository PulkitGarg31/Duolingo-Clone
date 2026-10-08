import { SvgIcon, type IconProps } from "./Icon";
import { ART, HIGHLIGHT } from "./palette";
import { HeartArt } from "./parts";

// A lemniscate drawn as two loops that cross at the heart's centre.
const INFINITY =
  "M16 15.8C14.6 13.9 13.1 12.8 11.6 12.8C9.8 12.8 8.5 14.1 8.5 15.8C8.5 17.5 9.8 18.8 11.6 18.8" +
  "C13.1 18.8 14.6 17.7 16 15.8C17.4 13.9 18.9 12.8 20.4 12.8C22.2 12.8 23.5 14.1 23.5 15.8" +
  "C23.5 17.5 22.2 18.8 20.4 18.8C18.9 18.8 17.4 17.7 16 15.8Z";

/** Unlimited hearts: a purple heart carrying a white infinity sign. */
export function UnlimitedHeartIcon(props: IconProps) {
  return (
    <SvgIcon box={[32, 32]} {...props}>
      <HeartArt
        fill={ART.beetle}
        shade={ART.beetleLip}
        highlight={HIGHLIGHT.color}
        highlightOpacity={HIGHLIGHT.opacity}
      />
      <path d={INFINITY} fill="none" stroke={ART.white} strokeWidth={2.6} strokeLinejoin="round" />
    </SvgIcon>
  );
}
