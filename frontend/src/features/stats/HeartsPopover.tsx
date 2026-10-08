import type { ReactNode } from "react";
import { GemIcon, HeartIcon, PracticeIcon, UnlimitedHeartIcon } from "@/components/icons";
import { ComingSoonPill } from "@/components/ui";
import type { HeartsOut } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { NextHeartIn } from "./NextHeartIn";

interface HeartsPopoverProps {
  hearts: HeartsOut;
  gems: number;
  onRefill: () => void;
  onPractice: () => void;
  onUnlimited: () => void;
  refilling: boolean;
  practicing: boolean;
}

/** Hearts left, when the next one regenerates, and the ways to get more. */
export function HeartsPopover({ hearts, gems, onRefill, onPractice, onUnlimited, refilling, practicing }: HeartsPopoverProps) {
  const full = hearts.current >= hearts.max;
  const busy = refilling || practicing;
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-heading text-fg">Hearts</h2>
      <div className="flex gap-1" role="img" aria-label={`${hearts.current} of ${hearts.max} hearts`}>
        {Array.from({ length: hearts.max }, (_, index) => (
          <HeartIcon key={index} variant={index < hearts.current ? "full" : "empty"} size={32} />
        ))}
      </div>
      {!full && hearts.nextHeartAt && (
        <p className="text-body text-fg">
          <NextHeartIn at={hearts.nextHeartAt} />
        </p>
      )}
      <HeartsMessage current={hearts.current} full={full} />
      <ul className="overflow-hidden rounded-[14px] border-2 border-line">
        <HeartOption
          icon={<UnlimitedHeartIcon size={40} />}
          label="Unlimited Hearts"
          trailing={<ComingSoonPill short />}
          muted
          onClick={onUnlimited}
        />
        <HeartOption
          icon={<HeartIcon size={40} />}
          label="Refill Hearts"
          trailing={full ? <span className="text-label text-fg-3 uppercase">Full</span> : <Price gems={hearts.refillPriceGems} />}
          disabled={full || gems < hearts.refillPriceGems || busy}
          onClick={onRefill}
        />
        <HeartOption
          icon={<PracticeIcon size={40} />}
          label="Practice to earn hearts"
          trailing={
            <span className="inline-flex items-center gap-1 text-[17px] font-extrabold text-heart">
              +1 <HeartIcon size={20} />
            </span>
          }
          disabled={full || busy}
          onClick={onPractice}
        />
      </ul>
    </div>
  );
}

function HeartsMessage({ current, full }: { current: number; full: boolean }) {
  if (full) {
    return (
      <div>
        <p className="text-body font-extrabold text-fg">You have full hearts</p>
        <p className="text-body text-fg-2">Keep on learning</p>
      </div>
    );
  }
  return (
    <p className="text-body text-fg-2">
      {current > 0 ? "You still have hearts left! Keep on learning" : "You have no hearts left! Try an option below"}
    </p>
  );
}

function Price({ gems }: { gems: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-[17px] font-extrabold text-gem tabular-nums">
      <GemIcon size={22} />
      {gems}
    </span>
  );
}

interface HeartOptionProps {
  icon: ReactNode;
  label: string;
  trailing: ReactNode;
  disabled?: boolean;
  /** A placeholder: still clickable (it explains it is coming soon), drawn faded. */
  muted?: boolean;
  onClick: () => void;
}

function HeartOption({ icon, label, trailing, disabled = false, muted = false, onClick }: HeartOptionProps) {
  return (
    <li className="border-t-2 border-line first:border-t-0">
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        className={cn(
          "flex min-h-16 w-full cursor-pointer items-center gap-4 px-4 py-3 text-left",
          "enabled:hover:bg-subtle focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus",
          "disabled:cursor-default disabled:opacity-60",
        )}
      >
        <span className={cn("shrink-0", muted && "opacity-60")}>{icon}</span>
        <span className={cn("flex-1 text-[17px] leading-5 font-extrabold text-fg", muted && "opacity-60")}>{label}</span>
        {trailing}
      </button>
    </li>
  );
}
