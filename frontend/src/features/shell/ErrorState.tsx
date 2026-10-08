"use client";

import { Owl } from "@/components/mascot";
import { Button, ButtonLink } from "@/components/ui";
import { ApiError } from "@/lib/api/errors";

interface ErrorStateProps {
  /** The failure; its request id (or Next's error digest) is shown in a chip to match the server logs. */
  error?: unknown;
  onRetry: () => void;
}

/** A page that failed to load or render: the sad owl, a reassurance, TRY AGAIN and a way back to the path. */
export function ErrorState({ error, onRetry }: ErrorStateProps) {
  const errorId = errorIdOf(error);
  return (
    <section role="alert" className="mx-auto flex max-w-[420px] flex-col items-center px-4 py-12 text-center">
      <Owl pose="sad" size={160} />
      <h1 className="mt-6 text-title text-fg-strong">Something went wrong</h1>
      <p className="mt-2 text-body text-fg-2">Don&apos;t worry, your progress is saved.</p>
      <div className="mt-8 grid w-full max-w-[330px] gap-2">
        <Button fullWidth onClick={onRetry}>
          Try again
        </Button>
        <ButtonLink href="/learn" variant="ghost" fullWidth>
          Back to learning
        </ButtonLink>
      </div>
      {errorId && (
        <p className="mt-6 rounded-full bg-subtle px-2 py-0.5 text-[13px] leading-4 font-extrabold text-fg-3">
          Error ID: {errorId}
        </p>
      )}
    </section>
  );
}

function errorIdOf(error: unknown): string | null {
  if (error instanceof ApiError) return error.requestId;
  if (error instanceof Error && "digest" in error && typeof error.digest === "string") return error.digest;
  return null;
}
