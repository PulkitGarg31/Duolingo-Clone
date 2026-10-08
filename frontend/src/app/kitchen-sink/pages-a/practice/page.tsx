import { PracticePreview } from "./PracticePreview";

export default async function PracticeKitchenSinkPage({ searchParams }: { searchParams: Promise<{ state?: string }> }) {
  const { state } = await searchParams;
  return <PracticePreview requested={state} />;
}
