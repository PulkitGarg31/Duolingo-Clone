import type { ReactNode } from "react";
import { GemIcon, HeartBrokenIcon, HeartIcon, HeartRefillIcon, PracticeIcon, UnlimitedHeartIcon } from "@/components/icons";
import { Button, CardButton, ComingSoonPill, Modal } from "@/components/ui";
import { NextHeartIn } from "@/features/stats/NextHeartIn";
import type { HeartsOut } from "@/lib/api/types";
import { cn } from "@/lib/cn";

interface NeedHeartsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hearts: HeartsOut;
  gems: number;
  onRefill: () => void;
  onPractice: () => void;
  onUnlimited: () => void;
  refilling: boolean;
  practicing: boolean;
}

/**
 * The start gate: START with no hearts left opens this instead of a lesson. It shows when the next heart
 * comes and the ways to get one now; practice is always allowed and earns a heart.
 */
export function NeedHeartsModal({ open, onOpenChange, hearts, gems, onRefill, onPractice, onUnlimited, refilling, practicing }: NeedHeartsModalProps) {
  const affordable = gems >= hearts.refillPriceGems;
  const busy = refilling || practicing;
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      illustration={<HeartBrokenIcon size={120} />}
      title="You need hearts to start new lessons!"
      description={hearts.nextHeartAt ? <NextHeartIn at={hearts.nextHeartAt} /> : undefined}
      actions={
        <Button variant="ghost" size="sm" fullWidth onClick={() => onOpenChange(false)}>
          No thanks
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        <OptionCard
          icon={<UnlimitedHeartIcon size={48} />}
          title="Unlimited Hearts"
          body="Never run out of hearts with Super!"
          trailing={<ComingSoonPill />}
          muted
          onClick={onUnlimited}
        />
        <OptionCard
          icon={<HeartRefillIcon size={48} />}
          title="Refill"
          body="Get full hearts so you can worry less about making mistakes in a lesson"
          trailing={
            affordable ? (
              <span className="inline-flex items-center gap-1 text-[17px] font-extrabold text-gem tabular-nums">
                <GemIcon size={22} />
                {hearts.refillPriceGems}
              </span>
            ) : (
              <span className="text-small text-fg-3">Not enough gems</span>
            )
          }
          disabled={!affordable || busy}
          onClick={onRefill}
        />
        <OptionCard
          icon={<PracticeIcon size={48} />}
          title="Practice to earn hearts"
          body="Review what you've learned and earn hearts"
          trailing={
            <span className="inline-flex items-center gap-1 text-[17px] font-extrabold text-heart">
              +1 <HeartIcon size={22} />
            </span>
          }
          disabled={busy}
          onClick={onPractice}
        />
      </div>
    </Modal>
  );
}

interface OptionCardProps {
  icon: ReactNode;
  title: string;
  body: string;
  trailing: ReactNode;
  disabled?: boolean;
  /** A Coming soon placeholder: clickable, drawn faded. */
  muted?: boolean;
  onClick: () => void;
}

function OptionCard({ icon, title, body, trailing, disabled = false, muted = false, onClick }: OptionCardProps) {
  return (
    <CardButton
      disabled={disabled}
      onClick={onClick}
      className={cn("grid grid-cols-[48px_1fr_auto] items-center gap-3 text-left", disabled && "opacity-60")}
    >
      <span className={cn(muted && "opacity-60")}>{icon}</span>
      <span className={cn("min-w-0", muted && "opacity-60")}>
        <span className="block text-[17px] leading-5 font-extrabold text-fg">{title}</span>
        <span className="mt-0.5 block text-small text-fg-2">{body}</span>
      </span>
      {trailing}
    </CardButton>
  );
}
