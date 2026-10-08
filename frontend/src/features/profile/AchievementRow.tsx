import type { ReactNode } from "react";
import { AchievementBadge, type AchievementArtCode } from "@/components/icons";
import { ComingSoonPill, ProgressBar } from "@/components/ui";
import type { AchievementOut } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { achievementProgress } from "./achievementProgress";

/** The row layout: a 64 × 80 badge tile (56 × 70 on phones) beside the text. */
const ROW = "grid grid-cols-[56px_1fr] items-center gap-4 px-5 py-4 md:grid-cols-[64px_1fr]";

/** One earned or in-progress achievement: badge tile, name, next-level description and progress. */
export function AchievementRow({ achievement }: { achievement: AchievementOut }) {
  const { code, name, description, level, maxLevel } = achievement;
  const { value, counter, maxed } = achievementProgress(achievement);
  return (
    <div className={ROW}>
      <Tile code={code} level={level} maxLevel={maxLevel} />
      <div className="min-w-0">
        <RowText name={name} description={description} />
        <div className="mt-2 flex items-center gap-3">
          <ProgressBar value={value} tone="gold" height={14} aria-label={`${name} progress`} className="flex-1" />
          <span className={cn("text-[15px] leading-[22px] font-extrabold tabular-nums", maxed ? "text-(--duo-guinea-pig)" : "text-fg-3")}>
            {counter}
          </span>
        </div>
      </div>
    </div>
  );
}

interface ComingSoonAchievementRowProps {
  code: Extract<AchievementArtCode, "friendly" | "photogenic">;
  name: string;
  description: string;
  onSelect: () => void;
}

/** An achievement that needs a feature we have not built yet: a grey tile and the COMING SOON pill. */
export function ComingSoonAchievementRow({ code, name, description, onSelect }: ComingSoonAchievementRowProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        ROW,
        "w-full cursor-pointer text-left [@media(hover:hover)]:hover:bg-subtle",
        "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus",
      )}
    >
      <Tile code={code} level={0} />
      <div className="min-w-0">
        <RowText name={name} description={description} />
        <ComingSoonPill className="mt-2" />
      </div>
    </button>
  );
}

function Tile({ code, level, maxLevel }: { code: AchievementArtCode; level: number; maxLevel?: number }) {
  return <AchievementBadge code={code} level={level} maxLevel={maxLevel} size={64} className="h-auto w-full" />;
}

function RowText({ name, description }: { name: string; description: ReactNode }) {
  return (
    <>
      <h3 className="text-card-title text-fg-strong">{name}</h3>
      <p className="text-body text-fg-2">{description}</p>
    </>
  );
}
