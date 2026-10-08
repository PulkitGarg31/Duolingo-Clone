"use client";

import { ErrorState } from "@/features/shell/ErrorState";

/**
 * A main page that failed while rendering; the app frame stays, the page offers TRY AGAIN, which refetches the
 * segment and renders it again.
 */
export default function MainError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <ErrorState error={error} onRetry={retry} />;
}
