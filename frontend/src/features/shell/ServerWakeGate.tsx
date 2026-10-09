"use client";

import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence } from "motion/react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useEffectEvent, type ReactNode } from "react";
import { useToast } from "@/components/ui/Toast";
import { getHealth } from "@/lib/api/endpoints";
import { ServerReadyContext, bootWatch, startKeepAlive, useWakeGate, wakeGate } from "@/lib/api/serverStatus";
import { tokenStore } from "@/lib/auth/tokenStore";
import { probeHealth } from "./healthProbe";
import { WakeScreen } from "./WakeScreen";

const RESTART_MESSAGE = "The demo server restarted, so progress was reset";

function pingHealth(): Promise<unknown> {
  return getHealth();
}

/**
 * Holds the app back until the API answers, because Render's free instance may be asleep. Children render
 * at once, but every query hook stays disabled until the server is ready. A slow wake-up covers the page
 * with the wake screen; a server that falls asleep later (a tab left open) brings it back as an overlay,
 * keeping the page and its state underneath. A server restart is announced and refreshes every query; a guest
 * hears about it only if its demo was lost, from the refused token's recovery, since a server that kept its
 * database reset nothing.
 */
export function ServerWakeGate({ children }: { children: ReactNode }) {
  const { phase, slow } = useWakeGate();
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();

  useEffect(() => {
    wakeGate.start(probeHealth);
  }, []);

  useEffect(() => {
    if (phase === "ready") startKeepAlive(pingHealth);
  }, [phase]);

  const onServerRestart = useEffectEvent(() => {
    if (tokenStore.kind() !== "guest") toast({ tone: "info", message: RESTART_MESSAGE });
    void queryClient.invalidateQueries();
    // The re-seeded database no longer has this tab's session.
    if (pathname.startsWith("/lesson/")) router.replace("/learn");
  });

  useEffect(() => bootWatch.subscribe(() => onServerRestart()), []);

  useEffect(() => {
    if (phase !== "failed") return;
    const retry = () => wakeGate.retry();
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
  }, [phase]);

  return (
    <ServerReadyContext.Provider value={phase === "ready"}>
      {children}
      <AnimatePresence>
        {(phase === "waking" || phase === "failed") && (
          <WakeScreen key="wake-screen" failed={phase === "failed"} slow={slow} onRetry={wakeGate.retry} />
        )}
      </AnimatePresence>
    </ServerReadyContext.Provider>
  );
}
