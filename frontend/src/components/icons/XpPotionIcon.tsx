import { useId } from "react";
import { SvgIcon, type IconProps } from "./Icon";
import { ART } from "./palette";
import { BOLT } from "./shapes";

// Neck and round bulb as one outline, so the tinted glass never doubles up where they meet.
const FLASK = "M13 5.6H19V10.06A10 10 0 1 1 13 10.06Z";
// The potion: a wavy surface over the bottom of the bulb.
const LIQUID = "M7.96 18C10.6 16.6 13.2 19 16 18C18.8 17 21.4 16.4 24.04 18A8.2 8.2 0 1 1 7.96 18Z";

/** XP Boost: a round flask of purple potion with a white bolt, stoppered with a purple cork. */
export function XpPotionIcon(props: IconProps) {
  const id = useId();
  const [glassClip, liquidClip] = [`${id}g`, `${id}l`];
  return (
    <SvgIcon box={[32, 32]} {...props}>
      <defs>
        <clipPath id={glassClip}>
          <path d={FLASK} />
        </clipPath>
        <clipPath id={liquidClip}>
          <path d={LIQUID} />
        </clipPath>
      </defs>
      {/* Lavender glass and purple potion, each darker in a crescent along its lower right. */}
      <path d={FLASK} fill={ART.white} />
      <g clipPath={`url(#${glassClip})`}>
        <path d={FLASK} fill={ART.beetle} fillOpacity={0.45} />
        <path d={FLASK} fill={ART.white} transform="translate(-1.2 -1.2)" />
        <path d={FLASK} fill={ART.beetle} fillOpacity={0.2} transform="translate(-1.2 -1.2)" />
      </g>
      <g clipPath={`url(#${liquidClip})`}>
        <path d={LIQUID} fill={ART.beetleLip} />
        <path d={LIQUID} fill={ART.beetle} transform="translate(-1 -1.1)" />
      </g>
      <path d={BOLT} fill={ART.white} transform="translate(16.4 22.6) scale(0.36) translate(-16 -16)" />
      <path
        d="M9.8 15.6C10.4 13.9 11.6 12.6 13 11.9"
        fill="none"
        stroke={ART.white}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
      <rect x={11.6} y={2.4} width={8.8} height={4.2} rx={1.8} fill={ART.beetleLip} />
    </SvgIcon>
  );
}
