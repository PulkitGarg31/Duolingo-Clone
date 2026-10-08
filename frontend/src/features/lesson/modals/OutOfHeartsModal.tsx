"use client";

import { useEffect, useState, type ReactNode } from "react";
import { GemIcon } from "@/components/icons/GemIcon";
import { HeartBrokenIcon } from "@/components/icons/HeartBrokenIcon";
import { HeartRefillIcon } from "@/components/icons/HeartRefillIcon";
import { UnlimitedHeartIcon } from "@/components/icons/UnlimitedHeartIcon";
import { Button } from "@/components/ui/Button";
import { CardButton } from "@/components/ui/Card";
import { ComingSoonPill } from "@/components/ui/ComingSoon";
import { Modal } from "@/components/ui/Modal";
import { formatTotal } from "@/lib/format";

/** The broken heart's halves drift apart this long after the modal opens. */
const BREAK_DELAY_MS = 400;

interface OutOfHeartsModalProps {
  open: boolean;
  /** The refill price, the same everywhere (`hearts.refillPriceGems`). */
  price: number;
  /** The learner's gems, or null while unknown (the server still checks). */
  gems: number | null;
  refilling: boolean;
  leaving: boolean;
  onRefill(): void;
  onNoThanks(): void;
}

/**
 * Opens after the CONTINUE that follows the lost last heart. REFILL HEARTS buys full hearts and the lesson
 * goes on; NO THANKS ends it with no XP. It cannot be dismissed any other way.
 */
export function OutOfHeartsModal({ open, price, gems, refilling, leaving, onRefill, onNoThanks }: OutOfHeartsModalProps) {
  const affordable = gems === null || gems >= price;
  const busy = refilling || leaving;
  return (
    <Modal
      open={open}
      onOpenChange={() => undefined}
      dismissible={false}
      illustration={<BreakingHeart />}
      title="You ran out of hearts!"
      description="You have no hearts left! Try an option below"
      actions={
        <>
          <Button
            fullWidth
            autoFocus
            disabled={!affordable || leaving}
            loading={refilling}
            onClick={onRefill}
            className="justify-self-center sm:max-w-[280px]"
          >
            Refill hearts
          </Button>
          <Button variant="ghost" size="sm" disabled={refilling} loading={leaving} onClick={onNoThanks} className="justify-self-center">
            No thanks
          </Button>
        </>
      }
    >
      <div role="radiogroup" aria-label="Ways to get hearts" className="grid gap-3 text-left">
        <HeartOption
          selected={affordable}
          disabled={!affordable || busy}
          icon={<HeartRefillIcon size={48} />}
          title="Refill"
          body="Get full hearts so you can worry less about making mistakes in a lesson"
          trailing={
            affordable ? (
              <span className="flex items-center gap-1 text-body font-extrabold text-gem">
                <GemIcon size={22} />
                {formatTotal(price)}
              </span>
            ) : (
              <span className="text-small font-extrabold text-fg-3">Not enough gems</span>
            )
          }
        />
        <HeartOption
          selected={false}
          disabled
          icon={<UnlimitedHeartIcon size={48} />}
          title="Unlimited Hearts"
          body="Never run out of hearts with Super!"
          trailing={<ComingSoonPill />}
        />
      </div>
    </Modal>
  );
}

/** Mounted with the modal's content each time it opens, so the heart breaks again every time. */
function BreakingHeart() {
  const [apart, setApart] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setApart(true), BREAK_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);
  return <HeartBrokenIcon size={120} apart={apart} />;
}

interface HeartOptionProps {
  selected: boolean;
  disabled: boolean;
  icon: ReactNode;
  title: string;
  body: string;
  trailing: ReactNode;
}

function HeartOption({ selected, disabled, icon, title, body, trailing }: HeartOptionProps) {
  return (
    <CardButton
      role="radio"
      aria-checked={selected}
      selected={selected}
      disabled={disabled}
      padding="md"
      className="grid grid-cols-[48px_1fr_auto] items-center gap-3 text-left disabled:opacity-100"
    >
      {icon}
      <span>
        <span className="block text-body font-extrabold text-fg">{title}</span>
        <span className="block text-small text-fg-2">{body}</span>
      </span>
      {trailing}
    </CardButton>
  );
}
