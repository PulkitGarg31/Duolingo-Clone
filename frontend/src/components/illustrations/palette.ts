/**
 * Fixed colours for artwork (the mascot, the cast and the picture cards).
 *
 * Art keeps its colours in both themes; only UI chrome flips. The theme tokens (`--duo-*`, `--c-*`) change in
 * dark mode, so drawings read these constants instead. The values are the brand palette's light-theme values,
 * plus a few of its illustration tints (skin and hair tones, pastel shades for white objects).
 */
export const ART = {
  white: "#FFFFFF",
  eel: "#4B4B4B",
  hare: "#AFAFAF",

  owl: "#58CC02",
  owlShade: "#46A302",
  maskGreen: "#89E219",
  turtle: "#A5ED6E",
  treeFrog: "#58A700",

  macaw: "#1CB0F6",
  whale: "#1899D6",
  blueJay: "#84D8FF",
  iguana: "#DDF4FF",
  anchovy: "#D2E4E8",
  humpback: "#2B70C9",
  narwhal: "#1453A3",

  cardinal: "#FF4B4B",
  fireAnt: "#EA2B2B",
  pig: "#F5A4A4",

  duck: "#FBE56D",
  bee: "#FFC800",
  lion: "#FFB100",
  camel: "#E7A601",
  canary: "#FFF5D3",
  fox: "#FF9600",
  foxShade: "#CD7900",

  beetle: "#CE82FF",
  beetleShade: "#A568CC",
  peacock: "#00CD9C",
  peacockShade: "#00A47D",
  starfish: "#FF86D0",
  starfishShade: "#CC6BA6",

  wood: "#B0723C",
  woodShade: "#8A5428",
  crust: "#E3A56C",
} as const;

/**
 * Skin tones for people, light to deep, each with a darker tone for ears and noses. The light, tan and brown
 * bases are the brand's illustration tints (cheetah, monkey, grizzly); the shades and the deep tone extend them.
 */
export const SKIN = {
  light: { base: "#FFCE8E", shade: "#F2B572" },
  tan: { base: "#E5A259", shade: "#CC8A45" },
  brown: { base: "#A56644", shade: "#8A5428" },
  deep: { base: "#7A4A2A", shade: "#633A1F" },
} as const;

export type Skin = (typeof SKIN)[keyof typeof SKIN];

/** Hair tones, each with a darker tone for the shaded side. */
export const HAIR = {
  dark: { base: "#4B4B4B", shade: "#3C3C3C" },
  brown: { base: "#A56644", shade: "#8A5428" },
  blond: { base: "#FFC800", shade: "#E7A601" },
  ginger: { base: "#FF9600", shade: "#CD7900" },
} as const;
