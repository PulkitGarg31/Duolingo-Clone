import { QueryClient } from "@tanstack/react-query";
import { ApiError, isRetryable } from "@/lib/api/errors";

// Every query and mutation rejects with an ApiError (apiFetch converts everything), so hooks expose it typed.
declare module "@tanstack/react-query" {
  interface Register {
    defaultError: ApiError;
  }
}

const QUERY_RETRIES = 6;
const MUTATION_RETRIES = 3;
const STALE_TIME_MS = 30_000;

/** 1 s, 2 s, 4 s, 8 s, then 10 s: long enough to ride out a server that is waking up. */
function retryDelay(attempt: number): number {
  return Math.min(1_000 * 2 ** attempt, 10_000);
}

/**
 * The app's QueryClient. It retries only what a second try can fix (a sleeping or unreachable server), never
 * a 4xx answer or a server bug.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: STALE_TIME_MS,
        retry: (failureCount, error) => isRetryable(error) && failureCount < QUERY_RETRIES,
        retryDelay,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: (failureCount, error) => isRetryable(error) && failureCount < MUTATION_RETRIES,
        retryDelay,
      },
    },
  });
}

/**
 * The toast text for a failed action that no feature handles itself: the server stayed unreachable through
 * the silent retries, or it hit a bug. Domain errors (409, 422, …) return null, because the feature that made
 * the request owns that experience (a modal, a disabled button, a shake).
 */
export function actionErrorMessage(error: unknown): string | null {
  if (!(error instanceof ApiError)) return "Something went wrong";
  if (isRetryable(error)) return "Couldn't reach the server. Try again.";
  if (error.status >= 500) return "Something went wrong";
  return null;
}

export interface ActionErrorNotice {
  message: string;
  /** Shown in the toast's error-ID chip so the failure can be matched with the server logs. */
  requestId: string | null;
}

/**
 * Calls `notify` once for every mutation that fails for good (after its retries) with an error from
 * `actionErrorMessage`. Returns the unsubscribe function.
 */
export function onUnhandledActionError(queryClient: QueryClient, notify: (notice: ActionErrorNotice) => void): () => void {
  return queryClient.getMutationCache().subscribe((event) => {
    if (event.type !== "updated" || event.action.type !== "error") return;
    const { error } = event.action;
    const message = actionErrorMessage(error);
    if (message) notify({ message, requestId: error instanceof ApiError ? error.requestId : null });
  });
}
