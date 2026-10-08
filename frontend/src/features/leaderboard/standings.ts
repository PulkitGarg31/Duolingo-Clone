import type { LeagueRowOut, LeagueZone } from "@/lib/api/types";

export type StandingsEntry =
  | { kind: "row"; row: LeagueRowOut }
  | { kind: "divider"; zone: "promotion" | "demotion" };

/**
 * The ranked rows with the zone lines between them: PROMOTION ZONE right under the last rank that moves up,
 * DEMOTION ZONE right above the first rank that moves down. A line only ever sits between two rows.
 */
export function withZoneDividers(rows: readonly LeagueRowOut[]): StandingsEntry[] {
  const entries: StandingsEntry[] = [];
  rows.forEach((row, index) => {
    const above = rows[index - 1];
    if (above?.zone === "promotion" && row.zone !== "promotion") entries.push({ kind: "divider", zone: "promotion" });
    if (above && above.zone !== "demotion" && row.zone === "demotion") entries.push({ kind: "divider", zone: "demotion" });
    entries.push({ kind: "row", row });
  });
  return entries;
}

/** The learner's own row; there is none before they join this week's league. */
export function myRow(rows: readonly LeagueRowOut[]): LeagueRowOut | undefined {
  return rows.find((row) => row.isMe);
}

/** The toast for a zone change between two refreshes of the board; null when there is nothing to announce. */
export function zoneChangeMessage(previous: LeagueZone | undefined, current: LeagueZone): string | null {
  if (previous === undefined || previous === current) return null;
  if (current === "promotion") return "You moved into the promotion zone!";
  if (current === "demotion") return "You moved down to the demotion zone!";
  return null;
}
