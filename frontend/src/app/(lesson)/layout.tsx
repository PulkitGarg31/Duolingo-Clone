import type { ReactNode } from "react";
import { ServerWakeGate } from "@/features/shell/ServerWakeGate";

export default function LessonLayout({ children }: { children: ReactNode }) {
  return <ServerWakeGate>{children}</ServerWakeGate>;
}
