import type { MeLeague } from "@/lib/api/types";
import { pluralize } from "@/lib/format";

/** `top`: fox · `up`: promotion green · `down`: demotion red · `neutral`: secondary text. */
export type LeagueStatusTone = "top" | "up" | "down" | "neutral";

export interface LeagueStatusLine {
  text: string;
  tone: LeagueStatusTone;
}

/** How close the demotion zone must be before the card warns about it. */
const DEMOTION_WARNING_RANKS = 3;

/**
 * The league card's one-line status under "You're ranked #n". The first rule that applies wins: top 3,
 * promotion zone, demotion zone, close to the demotion zone, otherwise the XP needed to pass the next learner.
 * Null before the learner has joined this week's leaderboard.
 */
export function leagueStatusLine(league: MeLeague): LeagueStatusLine | null {
  const { rank, zone } = league;
  if (rank === null) return null;
  if (rank <= 3) return { text: "Keep it up to stay in the top 3!", tone: "top" };
  if (zone === "promotion") return { text: "You're in the promotion zone!", tone: "up" };
  if (zone === "demotion") return { text: "You're in the demotion zone!", tone: "down" };

  // Ranks between the learner and the first rank of the demotion zone.
  const ranksAway = league.cohortSize - league.demoteCount + 1 - rank;
  if (league.demoteCount > 0 && ranksAway >= 1 && ranksAway <= DEMOTION_WARNING_RANKS) {
    return { text: `${pluralize(ranksAway, "rank")} away from the demotion zone!`, tone: "down" };
  }
  return { text: `You're only ${league.xpToPassNext ?? 0} XP away from moving up!`, tone: "neutral" };
}
