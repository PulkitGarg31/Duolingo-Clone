import type { LeagueRowOut } from "@/lib/api/types";
import { LeaderboardRow } from "./LeaderboardRow";
import { withZoneDividers } from "./standings";
import { ZoneDivider } from "./ZoneDivider";

/** This week's cohort in rank order, with the promotion and demotion lines between the zones. */
export function StandingsList({ rows }: { rows: readonly LeagueRowOut[] }) {
  return (
    <ol aria-label="This week's standings" className="pt-2 pb-6">
      {withZoneDividers(rows).map((entry) =>
        entry.kind === "row" ? (
          <LeaderboardRow key={entry.row.userId} row={entry.row} />
        ) : (
          <ZoneDivider key={entry.zone} zone={entry.zone} />
        ),
      )}
    </ol>
  );
}
