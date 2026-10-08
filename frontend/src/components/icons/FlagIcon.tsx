import { useId, type ReactNode } from "react";
import { SvgIcon, type IconProps } from "./Icon";
import { ART, GREY } from "./palette";

const THIRD = 32 / 3;
const US_STRIPE = 24 / 7;

// Simplified flags (no coats of arms) on a 32 × 24 artboard; the bands are plain rectangles clipped to the
// flag's rounded outline.
const FLAGS = {
  es: (
    <>
      <rect width={32} height={24} fill={ART.cardinal} />
      <rect y={6} width={32} height={12} fill={ART.bee} />
    </>
  ),
  fr: (
    <>
      <rect width={32} height={24} fill={ART.white} />
      <rect width={THIRD} height={24} fill={ART.macaw} />
      <rect x={2 * THIRD} width={THIRD} height={24} fill={ART.cardinal} />
    </>
  ),
  de: (
    <>
      <rect width={32} height={8} fill={ART.eel} />
      <rect y={8} width={32} height={8} fill={ART.cardinal} />
      <rect y={16} width={32} height={8} fill={ART.bee} />
    </>
  ),
  it: (
    <>
      <rect width={32} height={24} fill={ART.white} />
      <rect width={THIRD} height={24} fill={ART.owl} />
      <rect x={2 * THIRD} width={THIRD} height={24} fill={ART.cardinal} />
    </>
  ),
  ja: (
    <>
      <rect width={32} height={24} fill={ART.white} />
      <circle cx={16} cy={12} r={6.4} fill={ART.cardinal} />
    </>
  ),
  us: (
    <>
      <rect width={32} height={24} fill={ART.white} />
      {[0, 2, 4, 6].map((i) => (
        <rect key={i} y={i * US_STRIPE} width={32} height={US_STRIPE} fill={ART.cardinal} />
      ))}
      <rect width={14} height={4 * US_STRIPE} fill={ART.humpback} />
      {[3.5, 7, 10.5].flatMap((cx) =>
        [4, 9.6].map((cy) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={1.1} fill={ART.white} />),
      )}
    </>
  ),
} satisfies Record<string, ReactNode>;

export type FlagCode = keyof typeof FLAGS;

/** True when `code` (for example a course's `flagKey`) has a drawn flag. */
export function isFlagCode(code: string): code is FlagCode {
  return Object.hasOwn(FLAGS, code);
}

/** A neutral grey flag for codes without a drawing. */
const UNKNOWN_FLAG = (
  <>
    <rect width={32} height={24} fill={GREY.base} />
    <rect y={8} width={32} height={8} fill={GREY.mid} />
  </>
);

/**
 * A course flag: a simplified national flag with radius-6 corners and a 2-unit outline in the line colour.
 * `code` is a course's `flagKey` (es, fr, de, it, ja, us); unknown codes get a neutral grey flag.
 */
export function FlagIcon({ code, ...props }: IconProps & { code: string }) {
  const clip = useId();
  return (
    <SvgIcon box={[32, 24]} {...props}>
      <defs>
        <clipPath id={clip}>
          <rect width={32} height={24} rx={6} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clip})`}>{isFlagCode(code) ? FLAGS[code] : UNKNOWN_FLAG}</g>
      <rect x={1} y={1} width={30} height={22} rx={5} fill="none" stroke="var(--c-line)" strokeWidth={2} />
    </SvgIcon>
  );
}
