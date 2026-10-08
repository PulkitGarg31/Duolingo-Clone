"use client";

import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void): () => void {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/**
 * A notice while the browser is offline. Requests wait and resume on their own once the connection is back,
 * and nothing is queued meanwhile, so it promises no later sync.
 */
export function OfflineBanner() {
  const online = useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
  if (online) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[calc(var(--topbar-h)+8px)] z-(--z-toast) flex justify-center px-4 lg:top-4">
      <p
        role="status"
        className="rounded-full border-2 border-line bg-page px-4 py-2 text-small font-extrabold text-fg-2 shadow-[0_2px_0_var(--c-line)]"
      >
        You&apos;re offline. Reconnect to keep learning.
      </p>
    </div>
  );
}
