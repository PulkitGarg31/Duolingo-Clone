import { CompletionPreview } from "./CompletionPreview";
import { isScenarioId, type ScenarioId } from "./fixtures";

interface CompletionKitchenSinkProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Every screen shown after a session, played from fixture receipts. Query parameters open a given moment for
 * screenshots: `?scenario=golden&step=1&controls=0`.
 */
export default async function CompletionKitchenSinkPage({ searchParams }: CompletionKitchenSinkProps) {
  const { scenario, step, controls } = await searchParams;
  const initialScenario: ScenarioId = typeof scenario === "string" && isScenarioId(scenario) ? scenario : "golden";
  const initialStep = typeof step === "string" ? Math.max(0, Number.parseInt(step, 10) || 0) : 0;
  return <CompletionPreview initialScenario={initialScenario} initialStep={initialStep} showControls={controls !== "0"} />;
}
