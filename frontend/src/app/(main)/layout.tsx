import type { ReactNode } from "react";
import { AppShell } from "@/features/shell/AppShell";
import { GuestSessionGate } from "@/features/shell/GuestSessionGate";
import { ServerWakeGate } from "@/features/shell/ServerWakeGate";

/**
 * Every main page sits in the app frame, behind the gate that waits for the API to wake up and the one that
 * starts a private demo for a visitor without a token.
 */
export default function MainLayout({ children }: { children: ReactNode }) {
  return (
    <ServerWakeGate>
      <GuestSessionGate>
        <AppShell>{children}</AppShell>
      </GuestSessionGate>
    </ServerWakeGate>
  );
}
