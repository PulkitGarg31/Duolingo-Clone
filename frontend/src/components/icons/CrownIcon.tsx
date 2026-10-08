import { roundedPolygon } from "./geometry";
import { SvgIcon, type IconProps } from "./Icon";
import { ART } from "./palette";

// Three points (with round dots on their tips) rising from a flat base.
const BODY = roundedPolygon(
  [
    [4.2, 8],
    [8.6, 11.6],
    [13, 5],
    [17.4, 11.6],
    [21.8, 8],
    [20.6, 18.6],
    [5.4, 18.6],
  ],
  [1.4, 1.2, 1.4, 1.2, 1.4, 1.6, 1.6],
);
const TIPS = [
  [4.2, 7],
  [13, 4],
  [21.8, 7],
] as const;

/** `gold`: the crown badge of completed path nodes · `mono`: one colour (`currentColor`), e.g. on a gold button. */
export type CrownVariant = "gold" | "mono";

/** The crown's shapes in one colour; an `outline` stroke grows them by 2 units all round. */
function Silhouette({ fill, outline }: { fill: string; outline?: string }) {
  return (
    <g fill={fill} stroke={outline} strokeWidth={outline ? 4 : undefined} strokeLinejoin="round">
      <path d={BODY} />
      {TIPS.map(([cx, cy]) => (
        <circle key={cx} cx={cx} cy={cy} r={1.9} />
      ))}
    </g>
  );
}

/**
 * A crown with three dotted points and a darker band. The gold crown carries a 2-unit outline in the page
 * colour that separates it from whatever it overlaps, and shows `level` (a node's crown level) when given.
 */
export function CrownIcon({
  variant = "gold",
  level,
  ...props
}: IconProps & { variant?: CrownVariant; level?: number }) {
  return (
    <SvgIcon box={[26, 22]} {...props}>
      {variant === "mono" ? (
        <Silhouette fill="currentColor" />
      ) : (
        <>
          <Silhouette fill="var(--c-bg)" outline="var(--c-bg)" />
          <Silhouette fill={ART.bee} />
          <rect x={5.1} y={14.4} width={15.8} height={4.2} rx={1.6} fill={ART.camel} />
          {level !== undefined ? (
            <text x={13} y={17.9} textAnchor="middle" fontSize={10} fontWeight={900} fill={ART.cowbird}>
              {level}
            </text>
          ) : null}
        </>
      )}
    </SvgIcon>
  );
}
