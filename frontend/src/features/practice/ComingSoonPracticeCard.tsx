"use client";

import type { ReactNode } from "react";
import { ComingSoonPill } from "@/components/ui";
import { useComingSoon } from "@/features/shell/ComingSoon";
import { PracticeCard } from "./PracticeCard";

interface ComingSoonPracticeCardProps {
  icon: ReactNode;
  title: string;
  note: string;
  /** Completes the modal's "We're still building {feature}". */
  feature: string;
}

/** A practice mode that is not built yet: it carries the pill and opens the Coming soon modal. */
export function ComingSoonPracticeCard({ icon, title, note, feature }: ComingSoonPracticeCardProps) {
  const showComingSoon = useComingSoon();
  return (
    <PracticeCard icon={icon} title={title} note={note} badge={<ComingSoonPill />} onClick={() => showComingSoon(feature)} />
  );
}
