"use client";

import { ErrorState } from "@/features/shell/ErrorState";

/** A main page that failed while rendering; the app frame stays, the page offers TRY AGAIN. */
export default function MainError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorState error={error} onRetry={reset} />;
}
