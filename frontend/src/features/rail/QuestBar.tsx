import { ProgressBar } from "@/components/ui";
import { cn } from "@/lib/cn";

/** Height of a quest bar, in px. */
const BAR_HEIGHT = 18;
/** Once a quest has started, the fill is never narrower than this (the bar's own minimum: 1.5 × its height). */
const MIN_FILL_PX = BAR_HEIGHT * 1.5;

interface QuestBarProps {
  progress: number;
  target: number;
  /** Follows the count, as in "12 / 20 XP". */
  unit?: string;
  "aria-label": string;
}

/**
 * A gold quest bar with its count ("12 / 20") centred inside. The count is drawn twice, each copy clipped to
 * one side of the fill's edge: over the gold it keeps the quest ink, and over the empty track it switches to
 * the secondary text colour in dark mode, where the dark ink would disappear into the dark track.
 */
export function QuestBar({ progress, target, unit, "aria-label": ariaLabel }: QuestBarProps) {
  const value = target > 0 ? Math.min(1, Math.max(0, progress / target)) : 0;
  const count = unit ? `${progress} / ${target} ${unit}` : `${progress} / ${target}`;
  const edge = value > 0 ? `max(${MIN_FILL_PX}px, ${value * 100}%)` : "0px";
  return (
    <div className="relative">
      {/* The bar keeps the count as its accessible value text, but its own copy is drawn invisible. */}
      <ProgressBar
        value={value}
        tone="quest"
        height={BAR_HEIGHT}
        label={count}
        aria-label={ariaLabel}
        className="[--c-quest-fg:transparent]"
      />
      <CountLayer count={count} clipPath={`inset(0 calc(100% - ${edge}) 0 0)`} className="text-(--c-quest-fg)" />
      <CountLayer count={count} clipPath={`inset(0 0 0 ${edge})`} className="text-(--c-quest-fg) dark:text-fg-2" />
    </div>
  );
}

function CountLayer({ count, clipPath, className }: { count: string; clipPath: string; className: string }) {
  return (
    <span
      aria-hidden="true"
      style={{ clipPath }}
      className={cn(
        "pointer-events-none absolute inset-0 flex items-center justify-center text-[14px] leading-[18px] font-extrabold tabular-nums",
        // Follows the fill, which grows over 400 ms.
        "[transition:clip-path_400ms_ease]",
        className,
      )}
    >
      {count}
    </span>
  );
}
