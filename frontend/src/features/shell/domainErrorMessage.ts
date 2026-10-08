import type { ApiError, ApiErrorCode } from "@/lib/api/errors";
import { actionErrorMessage } from "@/lib/queries/queryClient";

/**
 * The toast text for a failed action, or null when there should be no toast from the feature: an unreachable
 * server or a server bug is already toasted app-wide. Known domain errors get their friendly copy; any other
 * domain error falls back to the server's own explanation.
 */
export function domainErrorMessage(error: ApiError, known: Partial<Record<ApiErrorCode, string>> = {}): string | null {
  if (actionErrorMessage(error) !== null) return null;
  return known[error.code] ?? (error.detail || "Something went wrong");
}
