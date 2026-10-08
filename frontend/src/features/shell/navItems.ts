import { matchesRoute } from "./routes";

export type NavKey = "learn" | "practice" | "leaderboard" | "quests" | "shop" | "profile";

export interface NavItem {
  key: NavKey;
  /** Sentence case: tooltips show it as is, the sidebar uppercases it. */
  label: string;
  href: string;
  /** Route prefixes that keep the item highlighted. */
  routes: readonly string[];
}

/** The app's destinations, in Duolingo's order. MORE is a menu rather than a destination, so it is not here. */
export const NAV_ITEMS: readonly NavItem[] = [
  // The guidebook is part of the path, so LEARN stays highlighted there.
  { key: "learn", label: "Learn", href: "/learn", routes: ["/learn", "/guidebook"] },
  { key: "practice", label: "Practice", href: "/practice", routes: ["/practice"] },
  { key: "leaderboard", label: "Leaderboards", href: "/leaderboard", routes: ["/leaderboard"] },
  { key: "quests", label: "Quests", href: "/quests", routes: ["/quests"] },
  { key: "shop", label: "Shop", href: "/shop", routes: ["/shop"] },
  { key: "profile", label: "Profile", href: "/profile", routes: ["/profile"] },
];

/** The menu item for the current page, or null on pages outside the menu (settings, placeholders). */
export function activeNavKey(pathname: string): NavKey | null {
  const item = NAV_ITEMS.find(({ routes }) => routes.some((route) => matchesRoute(pathname, route)));
  return item?.key ?? null;
}
