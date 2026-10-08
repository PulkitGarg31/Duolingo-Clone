import { LeaderboardPreview } from "./LeaderboardPreview";

export default async function LeaderboardKitchenSinkPage({ searchParams }: { searchParams: Promise<{ state?: string }> }) {
  const { state } = await searchParams;
  return <LeaderboardPreview requested={state} />;
}
