import { Owl } from "@/components/mascot/Owl";
import type { ApiError } from "@/lib/api/errors";

/** The sad owl and "Something went wrong", with the request id that matches the server's logs. */
export function ErrorNotice({ error }: { error: ApiError }) {
  return (
    <div role="alert" className="flex flex-col items-center py-8 text-center">
      <Owl pose="sad" size={160} />
      <h1 className="mt-4 text-title text-fg-strong">Something went wrong</h1>
      <p className="mt-2 text-body text-fg-2">Don&apos;t worry, your progress is saved.</p>
      {error.requestId && (
        <span className="mt-4 rounded-full bg-subtle px-2 py-0.5 text-caption text-fg-3">Error ID {error.requestId}</span>
      )}
    </div>
  );
}
