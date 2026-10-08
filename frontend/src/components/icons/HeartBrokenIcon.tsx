import { useId } from "react";
import { SvgIcon, type IconProps } from "./Icon";
import { ART } from "./palette";
import { HeartArt } from "./parts";

// The crack runs from the top notch to the tip; each half is clipped to its side of it.
const CRACK = "16,8.6 13.9,13.2 18.1,17.4 14.3,21.6 16,27.7";
const LEFT_HALF = `0,0 16,0 ${CRACK} 16,32 0,32`;
const RIGHT_HALF = `16,0 32,0 32,32 16,32 ${CRACK.split(" ").reverse().join(" ")}`;
// The halves pivot on the heart's tip.
const PIVOT = "16px 27.7px";

/**
 * Out of hearts: a heart split by a rounded zig-zag crack. With `apart` (the default) the halves lean 8° away
 * from each other around the tip; render it with `apart={false}` first and then flip it to animate the drift.
 */
export function HeartBrokenIcon({ apart = true, ...props }: IconProps & { apart?: boolean }) {
  const id = useId();
  const [left, right, crack] = [`${id}l`, `${id}r`, `${id}c`];
  const half = (clip: string, degrees: number) => (
    <g
      style={{
        transform: apart ? `rotate(${degrees}deg)` : "none",
        transformOrigin: PIVOT,
        transition: "transform 400ms var(--ease-spring)",
      }}
    >
      <g clipPath={`url(#${clip})`} mask={`url(#${crack})`}>
        <HeartArt fill={ART.cardinal} shade={ART.fireAnt} highlight={ART.flamingo} />
      </g>
    </g>
  );
  return (
    <SvgIcon box={[32, 32]} {...props}>
      <defs>
        <clipPath id={left}>
          <polygon points={LEFT_HALF} />
        </clipPath>
        <clipPath id={right}>
          <polygon points={RIGHT_HALF} />
        </clipPath>
        <mask id={crack} maskUnits="userSpaceOnUse" x={0} y={0} width={32} height={32}>
          <rect width={32} height={32} fill="white" />
          <polyline
            points={CRACK}
            fill="none"
            stroke="black"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </mask>
      </defs>
      <g transform="translate(1.6 1.8) scale(0.9)">
        {half(left, -8)}
        {half(right, 8)}
      </g>
    </SvgIcon>
  );
}
