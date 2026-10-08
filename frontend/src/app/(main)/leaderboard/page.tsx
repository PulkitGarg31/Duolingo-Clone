import type { Metadata } from "next";
import { LeaderboardPage } from "@/features/leaderboard/LeaderboardPage";

export const metadata: Metadata = { title: "Leaderboards" };

export default function LeaderboardRoute() {
  return <LeaderboardPage />;
}
