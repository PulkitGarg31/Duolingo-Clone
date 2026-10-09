"use client";

import { QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { MotionConfig } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { ToastProvider, useToast } from "@/components/ui/Toast";
import { guestSession } from "@/lib/auth/guestSession";
import { recoverFromRefusedToken } from "@/lib/auth/sessionExpiry";
import { tokenStore } from "@/lib/auth/tokenStore";
import { createQueryClient, onUnhandledActionError, pauseWhileServerAsleep } from "@/lib/queries/queryClient";
import { ThemeProvider, useTheme } from "@/lib/theme/ThemeProvider";

/**
 * App-wide providers. None of them calls the API on its own: fetching starts inside ServerWakeGate, which wraps
 * only the app's route groups, so the landing page, the kitchen sink and the 404 page render without a server.
 */
export function Providers({ children }: { children: ReactNode }) {
  // One client per browser tab, created on first render and kept for the tab's lifetime.
  const [queryClient] = useState(createQueryClient);
  // Requests and retries wait while the wake gate brings the server back, then continue.
  useEffect(() => pauseWhileServerAsleep(), []);
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <MotionPreferences>
          <ToastProvider>
            <ActionErrorToasts />
            <RefusedTokenRecovery />
            {children}
          </ToastProvider>
        </MotionPreferences>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

/** Motion's animations follow the same reduced-motion decision as the CSS (`html[data-motion]`). */
function MotionPreferences({ children }: { children: ReactNode }) {
  const { reducedMotion } = useTheme();
  return <MotionConfig reducedMotion={reducedMotion ? "always" : "never"}>{children}</MotionConfig>;
}

/** Toasts failed actions that no feature handles: an unreachable server after the retries, or a server bug. */
function ActionErrorToasts() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  useEffect(
    () => onUnhandledActionError(queryClient, ({ message, requestId }) => toast({ tone: "error", message, requestId })),
    [queryClient, toast],
  );
  return null;
}

/**
 * The server refused the session token (expired, revoked, or the server restarted and lost every account and
 * guest). apiFetch has dropped it already, and the cached screens belonging to it go too. A guest gets a new
 * private demo and stays in the app; an account holder lands on the welcome page to sign in again or try the
 * demo (see `recoverFromRefusedToken`).
 */
function RefusedTokenRecovery() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { toast } = useToast();
  useEffect(
    () =>
      tokenStore.onExpire((kind) =>
        recoverFromRefusedToken(kind, {
          clearCache: () => queryClient.clear(),
          startGuest: () => guestSession.ensure(),
          toast: (message) => toast({ tone: "info", message }),
          goTo: (href) => router.replace(href),
        }),
      ),
    [queryClient, router, toast],
  );
  return null;
}
