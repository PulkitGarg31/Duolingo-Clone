import { useId } from "react";
import { polygonPath, regularPolygon, roundedPolygon, shieldPath, starPoints } from "./geometry";
import { SvgIcon, type IconProps } from "./Icon";
import { ART, GREY } from "./palette";

type BadgeShape = "shield" | "hexagon" | "roundHexagon" | "gemHexagon";

interface BadgeStyle {
  shape: BadgeShape;
  /** Light outer rim, inset face, darker bottom lip and the colour of the centre star. */
  rim: string;
  face: string;
  lip: string;
  glyph: string;
}

// Indexed by tier - 1, from Bronze (1) to Diamond (10).
const LEAGUES: readonly BadgeStyle[] = [
  { shape: "shield", rim: "#E4AC7C", face: "#D4A880", lip: "#C88C54", glyph: "#A56B3A" }, // Bronze
  { shape: "shield", rim: "#D4E4EC", face: "#C9D6E2", lip: "#A8C0D4", glyph: "#8EA3B5" }, // Silver
  { shape: "shield", rim: "#FCE030", face: "#FCD440", lip: "#FCC000", glyph: "#F89400" }, // Gold
  { shape: "hexagon", rim: "#44C4FC", face: "#34B8F4", lip: "#0090CC", glyph: "#0B6E9E" }, // Sapphire
  { shape: "hexagon", rim: "#FC7474", face: "#FC6060", lip: "#E03434", glyph: "#B32020" }, // Ruby
  { shape: "hexagon", rim: "#84E000", face: "#88CC1C", lip: "#60A400", glyph: "#3E7A00" }, // Emerald
  { shape: "hexagon", rim: "#D9A6FF", face: "#CE82FF", lip: "#A568CC", glyph: "#7B44A8" }, // Amethyst
  { shape: "roundHexagon", rim: "#FFE3F3", face: "#FFAADE", lip: "#E58DC2", glyph: "#C25C9B" }, // Pearl
  { shape: "roundHexagon", rim: "#6B6B78", face: "#4B4B57", lip: "#2E2E36", glyph: "#A7A0FF" }, // Obsidian
  { shape: "gemHexagon", rim: "#E7FBFB", face: "#38D0D0", lip: "#00ACB2", glyph: "#FFFFFF" }, // Diamond
];

// The keyhole takes the lip grey: hare would vanish against the dark theme's face.
const LOCKED_COLOURS = { rim: GREY.base, face: GREY.mid, lip: GREY.lip, glyph: GREY.lip };

const FACE_CENTRE = 27;
const HEXAGON = (radius: number, corner: number) =>
  roundedPolygon(regularPolygon(26, FACE_CENTRE, radius, 6), corner);

const OUTLINES: Record<BadgeShape, { rim: string; face: string }> = {
  shield: { rim: shieldPath(3, 2, 46, 49, 7), face: shieldPath(8.5, 7.5, 35, 38, 4) },
  hexagon: { rim: HEXAGON(25, 4.5), face: HEXAGON(19, 3) },
  roundHexagon: { rim: HEXAGON(25, 9), face: HEXAGON(19, 6.5) },
  gemHexagon: { rim: HEXAGON(25, 4.5), face: HEXAGON(19, 3) },
};

// Diamond's face is cut into six triangles around the centre; every other one catches the light.
const GEM_FACETS = regularPolygon(26, FACE_CENTRE, 19, 6)
  .map((corner, i, corners) => polygonPath([[26, FACE_CENTRE], corner, corners[(i + 1) % corners.length]]))
  .filter((_, i) => i % 2 === 0)
  .join("");

// A 45° band from the top right to the bottom left, clipped to the rim.
const GLOSS_BAND = "M46.3 0H57.7L-0.3 58H-11.7Z";
const STAR = roundedPolygon(starPoints(26, 28, 10.5, 5), [2, 1]);
// A round head over a slot that widens to a rounded foot.
const KEYHOLE =
  "M26 20.2A4.2 4.2 0 0 1 28.6 27.7L29.4 32.4A1.4 1.4 0 0 1 28 34H24A1.4 1.4 0 0 1 22.6 32.4" +
  "L23.4 27.7A4.2 4.2 0 0 1 26 20.2Z";

/**
 * A league badge (52 × 58 artboard): a shield for Bronze to Gold, a hexagon from Sapphire up (rounder for Pearl
 * and Obsidian, gem-cut for Diamond). Light rim, inset face, darker lip, one diagonal gloss band and a star.
 * `locked` (a league not reached yet) draws the same shape in the theme's greys with a keyhole; tiers outside
 * 1–10 also render locked. Locked badges are flat: no gloss band.
 */
export function LeagueBadge({ tier, locked = false, ...props }: IconProps & { tier: number; locked?: boolean }) {
  const clip = useId();
  const league = LEAGUES[tier - 1];
  const shape = league?.shape ?? "shield";
  const isLocked = locked || !league;
  const colours = isLocked ? LOCKED_COLOURS : league;
  const { rim, face } = OUTLINES[shape];
  return (
    <SvgIcon box={[52, 58]} {...props}>
      <path d={rim} fill={colours.lip} transform="translate(0 4.5)" />
      <path d={rim} fill={colours.rim} />
      <path d={face} fill={colours.face} />
      {isLocked ? null : (
        <>
          <defs>
            <clipPath id={clip}>
              <path d={rim} />
            </clipPath>
          </defs>
          {shape === "gemHexagon" ? <path d={GEM_FACETS} fill={ART.white} fillOpacity={0.2} /> : null}
          <path d={GLOSS_BAND} fill={ART.white} fillOpacity={0.25} clipPath={`url(#${clip})`} />
        </>
      )}
      <path d={isLocked ? KEYHOLE : STAR} fill={colours.glyph} />
    </SvgIcon>
  );
}
