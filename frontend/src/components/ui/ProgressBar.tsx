import { cn } from "@/lib/cn";

/**
 * - `fill`: lessons (owl green); `hot` and `fire` at 6 and 11 correct answers in a row.
 * - `gold`: Legendary; `beetle`: Timed practice.
 * - `quest`: quests and the daily goal, usually with the "12 / 20" label inside.
 */
export type ProgressTone = "fill" | "hot" | "fire" | "gold" | "beetle" | "quest";

const TONE_CLASSES: Record<ProgressTone, string> = {
  fill: "bg-fill",
  hot: "bg-fill-hot",
  fire: "bg-fill-fire",
  gold: "bg-gold",
  beetle: "bg-beetle",
  quest: "bg-quest",
};

/** One copy of the label: centred across the whole track, from its left edge. */
const LABEL_COPY =
  "absolute inset-y-0 left-0 flex items-center justify-center text-[14px] leading-[18px] font-extrabold tabular-nums";

interface ProgressBarProps {
  /** Progress from 0 to 1; values outside are clamped. */
  value: number;
  tone?: ProgressTone;
  /** Bar height in px; the corners are always fully round. */
  height?: number;
  /** Text centred in the bar, e.g. "12 / 20". It also becomes the value screen readers announce. */
  label?: string;
  "aria-label"?: string;
  className?: string;
}

/**
 * A rounded track with a gloss stripe inside the fill. Once there is any progress the fill is at least
 * 1.5 × the height wide, so its rounded end never collapses into a sliver. Width and colour changes are
 * animated by the global `.progress-fill` transition.
 *
 * The label is drawn twice so it reads on both sides of the fill's edge. One copy lies on the track, under the
 * fill, in the track's ink: the quest ink, or the secondary text colour on the dark theme's dark track. The
 * other rides inside the fill in the quest ink, clipped to the fill's shape even while it grows. The copies
 * line up because both span the track: the bar is a size container and the inner copy is `100cqw` wide.
 */
export function ProgressBar({ value, tone = "fill", height = 16, label, className, "aria-label": ariaLabel }: ProgressBarProps) {
  const progress = Math.min(1, Math.max(0, value));
  return (
    <div
      role="progressbar"
      aria-label={ariaLabel}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress * 100)}
      aria-valuetext={label}
      className={cn("relative w-full bg-track", label && "@container", className)}
      style={{ height, borderRadius: height / 2 }}
    >
      {label && (
        <span aria-hidden="true" className={cn(LABEL_COPY, "right-0 text-(--c-quest-fg) dark:text-fg-2")}>
          {label}
        </span>
      )}
      <div
        className={cn("progress-fill relative h-full", label && "overflow-hidden", TONE_CLASSES[tone])}
        style={{ width: `${progress * 100}%`, minWidth: progress > 0 ? height * 1.5 : 0, borderRadius: "inherit" }}
      >
        {progress > 0 && (
          <span
            className="absolute top-1/4 h-[30%] rounded-full bg-(--c-gloss)"
            style={{ left: height / 4, right: height / 4 }}
          />
        )}
        {label && (
          <span aria-hidden="true" className={cn(LABEL_COPY, "w-[100cqw] text-(--c-quest-fg)")}>
            {label}
          </span>
        )}
      </div>
    </div>
  );
}
