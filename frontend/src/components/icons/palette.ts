/**
 * Colours for the icon artwork, named after the palette tokens they come from.
 *
 * Brand-coloured art looks the same in both themes, so it uses the palette's fixed values: the matching UI
 * tokens (for example `--duo-fox`) brighten in dark mode, and the art must not. Only the greys of inactive,
 * empty and locked art follow the theme, so `GREY` points at the theme's tokens instead.
 */
export const ART = {
  white: "#FFFFFF",
  swan: "#E5E5E5",
  hare: "#AFAFAF",
  eel: "#4B4B4B",
  owl: "#58CC02",
  treeFrog: "#58A700",
  macaw: "#1CB0F6",
  whale: "#1899D6",
  blueJay: "#84D8FF",
  iguana: "#DDF4FF",
  humpback: "#2B70C9",
  cardinal: "#FF4B4B",
  fireAnt: "#EA2B2B",
  flamingo: "#FFB2B2",
  bee: "#FFC800",
  camel: "#E7A601",
  guineaPig: "#CD7900",
  cowbird: "#AE6802",
  canary: "#FFF5D3",
  goldShine: "#FFE700",
  fox: "#FF9600",
  beetle: "#CE82FF",
  beetleLip: "#A568CC",
  wood: "#B0723C",
  woodLip: "#8A5428",
} as const;

/** Theme-aware greys for inactive, empty and locked art (light → dark: swan, koala, swan × 0.8, hare). */
export const GREY = {
  base: "var(--c-node-locked)",
  mid: "var(--duo-koala)",
  lip: "var(--c-node-locked-lip)",
  dark: "var(--c-node-locked-glyph)",
} as const;

/** The single top-left highlight on coloured art: white at partial opacity. */
export const HIGHLIGHT = { color: ART.white, opacity: 0.45 } as const;

/** `hex` with every channel multiplied by `factor`: 0.8 gives the darker "lip" of a palette colour. */
export function shade(hex: string, factor: number): string {
  const channels = [1, 3, 5].map((start) => Math.round(parseInt(hex.slice(start, start + 2), 16) * factor));
  return `#${channels.map((channel) => channel.toString(16).padStart(2, "0").toUpperCase()).join("")}`;
}
