import type { ReactNode } from "react";
import { ChevronIcon } from "@/components/icons/ChevronIcon";
import { CardButton } from "@/components/ui";
import { cn } from "@/lib/cn";

interface PracticeCardProps {
  icon: ReactNode;
  title: string;
  /** What the card offers, or why it is off right now. */
  note: string;
  /** A pill beside the title, such as COMING SOON; it wraps under the title on narrow phones. */
  badge?: ReactNode;
  disabled?: boolean;
  /** Its session is being created: the card ignores clicks until the lesson opens. */
  busy?: boolean;
  onClick: () => void;
}

/** One practice option: a 64 px picture, a title and a note, and a chevron saying it leads somewhere. */
export function PracticeCard({ icon, title, note, badge, disabled = false, busy = false, onClick }: PracticeCardProps) {
  return (
    <CardButton
      padding="lg"
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      onClick={onClick}
      className="grid w-full grid-cols-[64px_1fr_auto] items-center gap-4 text-left"
    >
      <span className={cn("relative", disabled && "opacity-50 grayscale")}>{icon}</span>
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className={cn("text-card-title", disabled ? "text-fg-3" : "text-fg")}>{title}</span>
          {badge}
        </span>
        <span className="mt-1 block text-body text-fg-2">{note}</span>
      </span>
      <ChevronIcon size={24} className={disabled ? "text-fg-faint" : "text-fg-3"} />
    </CardButton>
  );
}
