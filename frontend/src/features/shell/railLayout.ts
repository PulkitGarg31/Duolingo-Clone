import { matchesRoute } from "./routes";

/** One block of the right rail, top to bottom. */
export type RailBlock = "stats" | "league" | "quests" | "super" | "friends" | "settingsNav" | "footer";

export interface RailLayout {
  /** The rail is 368 px wide, 380 px on settings. */
  width: 368 | 380;
  blocks: readonly RailBlock[];
}

/** Each page's cards between the stats row and the footer. */
const PAGE_CARDS: ReadonlyArray<readonly [route: string, cards: readonly RailBlock[]]> = [
  ["/learn", ["league", "quests", "super"]],
  ["/leaderboard", ["quests", "super"]],
  ["/quests", ["league", "super"]],
  ["/shop", ["league", "quests"]],
  ["/profile", ["friends", "quests"]],
  ["/practice", ["quests"]],
  ["/guidebook", ["quests"]],
];

const DEFAULT_CARDS: readonly RailBlock[] = ["quests"];

/** The right rail's blocks for a page. Settings swaps the stats and cards for its own section menu. */
export function railLayoutFor(pathname: string): RailLayout {
  if (matchesRoute(pathname, "/settings")) return { width: 380, blocks: ["settingsNav", "footer"] };
  const cards = PAGE_CARDS.find(([route]) => matchesRoute(pathname, route))?.[1] ?? DEFAULT_CARDS;
  return { width: 368, blocks: ["stats", ...cards, "footer"] };
}
