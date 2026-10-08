import { QuestsPreview } from "./QuestsPreview";

export default async function QuestsKitchenSinkPage({ searchParams }: { searchParams: Promise<{ state?: string }> }) {
  const { state } = await searchParams;
  return <QuestsPreview requested={state} />;
}
