import { roundedPolygon, type Point } from "./geometry";
import { SvgIcon, type IconProps } from "./Icon";
import { ART, HIGHLIGHT } from "./palette";

export type MedalRank = 1 | 2 | 3;

// Gold, silver and bronze discs with a darker ring; the rank number takes the darkest shade so it stays legible.
const MEDALS: Record<MedalRank, { disc: string; ring: string; number: string }> = {
  1: { disc: "#FFC800", ring: "#E7A601", number: "#CD7900" },
  2: { disc: "#C9D6E2", ring: "#A8C0D4", number: "#8EA3B5" },
  3: { disc: "#E4AC7C", ring: "#C88C54", number: "#A56B3A" },
};

// Ribbon tails hanging behind the disc, each ending in a notch; the right tail mirrors the left.
const LEFT_TAIL: Point[] = [
  [13.6, 22.4],
  [20.2, 25.4],
  [16.4, 39.6],
  [13.4, 36.8],
  [9.6, 38.8],
];
const LEFT_TAIL_PATH = roundedPolygon(LEFT_TAIL, 1.2);
const RIGHT_TAIL_PATH = roundedPolygon(
  LEFT_TAIL.map(([x, y]): Point => [41 - x, y]),
  1.2,
);

/** Leaderboard ranks 1–3: a medal disc with the rank number and two ribbon tails (41 × 42 artboard). */
export function MedalIcon({ rank, ...props }: IconProps & { rank: MedalRank }) {
  const { disc, ring, number } = MEDALS[rank];
  return (
    <SvgIcon box={[41, 42]} {...props}>
      <path d={LEFT_TAIL_PATH} fill={ART.macaw} />
      <path d={RIGHT_TAIL_PATH} fill={ART.cardinal} />
      <circle cx={20.5} cy={16} r={14} fill={ring} />
      <circle cx={20.5} cy={16} r={11} fill={disc} />
      <path
        d="M12.6 14.2C13 11.6 14.6 9.6 16.8 8.6"
        fill="none"
        stroke={HIGHLIGHT.color}
        strokeOpacity={HIGHLIGHT.opacity}
        strokeWidth={2}
        strokeLinecap="round"
      />
      <text x={20.5} y={21.2} textAnchor="middle" fontSize={15} fontWeight={900} fill={number}>
        {rank}
      </text>
    </SvgIcon>
  );
}
