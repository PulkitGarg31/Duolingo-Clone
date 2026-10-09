"use client";

import { Owl } from "@/components/mascot/Owl";
import { cn } from "@/lib/cn";
import { Button, ButtonLink } from "./Button";
import { Modal } from "./Modal";
import { Pill } from "./Pill";

/**
 * Placeholder features never lead nowhere: their entry point stays clickable, carries this pill and opens
 * the Coming soon modal.
 */
export function ComingSoonPill({ short = false, className }: { short?: boolean; className?: string }) {
  return (
    <Pill tone="beetle" className={className}>
      {short ? "Soon" : "Coming soon"}
    </Pill>
  );
}

interface ComingSoonModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Completes "We're still building {feature}", e.g. "Stories" or "the friends list". */
  feature: string;
}

export function ComingSoonModal({ open, onOpenChange, feature }: ComingSoonModalProps) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="sm"
      illustration={<Owl pose="build" size={140} />}
      title="Coming soon!"
      description={`We're still building ${feature}. Check back later!`}
      actions={<Button onClick={() => onOpenChange(false)}>Got it</Button>}
    />
  );
}

interface ComingSoonPageProps {
  /** Completes "We're still building {feature}". */
  feature: string;
  /** Defaults to "{Feature} is coming soon". */
  title?: string;
  className?: string;
}

/** A whole page for a placeholder route (/super, /friends). */
export function ComingSoonPage({ feature, title, className }: ComingSoonPageProps) {
  const heading = title ?? `${feature.charAt(0).toLocaleUpperCase()}${feature.slice(1)} is coming soon`;
  return (
    <section className={cn("mx-auto flex max-w-[420px] flex-col items-center px-4 py-12 text-center", className)}>
      <Owl pose="build" size={200} />
      <h1 className="mt-6 text-[1.5rem]/[1.875rem] font-extrabold text-fg-strong md:text-title-lg">{heading}</h1>
      <p className="mt-3 text-body text-fg-2">{`We're still building ${feature}. Check back later!`}</p>
      <ButtonLink href="/learn" variant="secondary" className="mt-8">
        Back to learning
      </ButtonLink>
    </section>
  );
}
