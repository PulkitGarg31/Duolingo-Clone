"use client";

import { useEffect } from "react";
import { ErrorState } from "@/features/shell/ErrorState";

export interface ErrorPageProps {
  error: Error & { digest?: string };
  /** Fetches and renders the failed segment again. */
  retry: () => void;
}

/**
 * The error page for everything outside the app frame's own boundary: the landing page, the lesson routes
 * and a failure in the frame itself. Full screen, since there is no frame around it.
 */
export default function RootError({ error, retry }: ErrorPageProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-page">
      <ErrorState error={error} onRetry={retry} />
    </main>
  );
}
