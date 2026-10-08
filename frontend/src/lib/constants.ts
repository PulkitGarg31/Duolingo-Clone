/** The product name, rendered as the wordmark and in page titles. Set NEXT_PUBLIC_APP_NAME to rename it. */
export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME?.trim() || "owlingo";

/** Shown in every page footer: the right rail, the landing page and settings. */
export const DISCLAIMER = `${APP_NAME} is an educational clone built for a hiring assignment. Not affiliated with or endorsed by Duolingo.`;

/**
 * The palette the server draws every user's `avatarColor` from. Real users always carry their colour from the
 * API (never hash ids on the client); this list is for placeholder avatars that have no API user behind them.
 */
export const AVATAR_COLORS = ["#58CC02", "#1CB0F6", "#CE82FF", "#FF9600", "#FF4B4B", "#00CD9C", "#FF86D0", "#2B70C9"] as const;
