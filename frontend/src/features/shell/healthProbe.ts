import { getHealth } from "@/lib/api/endpoints";
import { HEALTH_PROBE_TIMEOUT_MS, bootWatch } from "@/lib/api/serverStatus";

/** One /health probe for the wake gate. The body's boot id also feeds restart detection. */
export async function probeHealth(): Promise<void> {
  const health = await getHealth({ timeoutMs: HEALTH_PROBE_TIMEOUT_MS });
  bootWatch.observe(health.bootId);
}
