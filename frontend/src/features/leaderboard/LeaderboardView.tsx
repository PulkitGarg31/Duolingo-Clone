import type { LeagueOut } from "@/lib/api/types";
import { JoinPrompt } from "./JoinPrompt";
import { LeagueHeader } from "./LeagueHeader";
import { LockedLeaderboard } from "./LockedLeaderboard";
import { StandingsList } from "./StandingsList";

export interface LeaderboardViewProps {
  league: LeagueOut;
  /** Called when the week's countdown reaches zero. */
  onWeekEnd?: () => void;
}

/** The leaderboard page: locked, waiting for the week's first lesson, or this week's standings. */
export function LeaderboardView({ league, onWeekEnd }: LeaderboardViewProps) {
  return (
    <div className="mx-auto w-full max-w-[592px]">
      {league.unlocked ? (
        <>
          <LeagueHeader league={league} onWeekEnd={onWeekEnd} />
          {league.joined ? <StandingsList rows={league.rows} /> : <JoinPrompt />}
        </>
      ) : (
        <LockedLeaderboard lessonsToUnlock={league.lessonsToUnlock} />
      )}
    </div>
  );
}
