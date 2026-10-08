import type { ReactNode } from "react";
import { AppShell } from "@/features/shell/AppShell";
import { ServerWakeGate } from "@/features/shell/ServerWakeGate";

/** Every main page sits in the app frame, behind the gate that waits for the API to wake up. */
export default function MainLayout({ children }: { children: ReactNode }) {
  return (
    <ServerWakeGate>
      <AppShell>{children}</AppShell>
    </ServerWakeGate>
  );
}
