import { AchievementArt, type AchievementArtCode } from "./AchievementArt";
import { SvgIcon, type IconProps } from "./Icon";
import { ART, GREY, shade } from "./palette";

// Each illustration is drawn to stand out on its own tile colour (the same colours the API sends as `color`).
const TILE_COLOURS: Record<AchievementArtCode, string> = {
  wildfire: "#FF9600",
  sage: "#1CB0F6",
  scholar: "#CE82FF",
  sharpshooter: "#FF4B4B",
  champion: "#58CC02",
  winner: "#FFC800",
  legendary: "#38D0D0",
  friendly: "#FF86D0",
  photogenic: "#CE82FF",
};
const GOLD = { tile: "#FFC800", lip: "#E6A000" };
const COMING_SOON: ReadonlySet<AchievementArtCode> = new Set(["friendly", "photogenic"]);

// `list` is the profile row tile, `modal` the "unlocked!" tile. The lip sits inside the artboard height.
const LAYOUTS = {
  list: { width: 64, height: 80, lip: 4, radius: 12, art: 40, artTop: 10, fontSize: 11, labelBaseline: 70 },
  modal: { width: 120, height: 140, lip: 8, radius: 16, art: 80, artTop: 16, fontSize: 17, labelBaseline: 120 },
} as const;

export type AchievementBadgeVariant = keyof typeof LAYOUTS;

interface AchievementBadgeProps extends IconProps {
  code: AchievementArtCode;
  /** Levels earned so far; 0 draws the grey "not earned yet" tile, labelled with the level being worked towards. */
  level?: number;
  /** The top level; reaching it turns the tile gold. */
  maxLevel?: number;
  variant?: AchievementBadgeVariant;
}

/**
 * An achievement tile: the badge colour with a darker lip (colour × 0.8), the illustration and "LEVEL n".
 * Not earned yet (and the Coming soon badges) is grey with a grey label; the top level is gold.
 */
export function AchievementBadge({ code, level = 0, maxLevel, variant = "list", ...props }: AchievementBadgeProps) {
  const layout = LAYOUTS[variant];
  const earned = level > 0 && !COMING_SOON.has(code);
  const maxed = earned && maxLevel !== undefined && level >= maxLevel;
  const tile = !earned ? GREY.base : maxed ? GOLD.tile : TILE_COLOURS[code];
  const lip = !earned ? GREY.lip : maxed ? GOLD.lip : shade(TILE_COLOURS[code], 0.8);
  // White does not read on gold, so gold tiles take the darker gold used for text on gold.
  const label = !earned ? GREY.dark : tile === GOLD.tile ? ART.guineaPig : ART.white;
  const tileHeight = layout.height - layout.lip;
  return (
    <SvgIcon box={[layout.width, layout.height]} {...props}>
      <rect y={layout.lip} width={layout.width} height={tileHeight} rx={layout.radius} fill={lip} />
      <rect width={layout.width} height={tileHeight} rx={layout.radius} fill={tile} />
      <g transform={`translate(${(layout.width - layout.art) / 2} ${layout.artTop})`}>
        <AchievementArt code={code} muted={!earned} size={layout.art} />
      </g>
      <text
        x={layout.width / 2}
        y={layout.labelBaseline}
        textAnchor="middle"
        fontSize={layout.fontSize}
        fontWeight={900}
        fill={label}
      >
        LEVEL {Math.max(level, 1)}
      </text>
    </SvgIcon>
  );
}
