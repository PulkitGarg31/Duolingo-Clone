import type { ReactNode } from "react";
import { ServerWakeGate } from "@/features/shell/ServerWakeGate";

/**
 * Lessons take the whole screen: no sidebar, top bar or tabs. The wake gate stays, so a lesson opened on a
 * sleeping server waits for it (and an answer sent while it naps goes out once it is back).
 */
export default function LessonLayout({ children }: { children: ReactNode }) {
  return (
    <ServerWakeGate>
      <div className="min-h-dvh bg-page text-fg">{children}</div>
    </ServerWakeGate>
  );
}
