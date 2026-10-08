import { LessonKitchenSink } from "./LessonKitchenSink";

export default async function LessonKitchenSinkPage({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const { s } = await searchParams;
  return <LessonKitchenSink scenarioId={s ?? null} />;
}
