"use client";

import type { ReactNode } from "react";
import { CardButton, ComingSoonPill } from "@/components/ui";
import { useComingSoon } from "@/features/shell/ComingSoon";

interface ComingSoonQuestCardProps {
  art: ReactNode;
  title: string;
  body: string;
  /** Completes the modal's "We're still building {feature}". */
  feature: string;
}

/** A quest type that is not built yet. It stays clickable and opens the Coming soon modal. */
export function ComingSoonQuestCard({ art, title, body, feature }: ComingSoonQuestCardProps) {
  const showComingSoon = useComingSoon();
  return (
    <CardButton
      padding="lg"
      onClick={() => showComingSoon(feature)}
      className="grid w-full grid-cols-[72px_1fr] items-center gap-4 text-left"
    >
      <span aria-hidden="true" className="flex justify-center">
        {art}
      </span>
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-card-title text-fg">{title}</span>
          <ComingSoonPill />
        </span>
        <span className="mt-1 block text-body text-fg-2">{body}</span>
      </span>
    </CardButton>
  );
}
