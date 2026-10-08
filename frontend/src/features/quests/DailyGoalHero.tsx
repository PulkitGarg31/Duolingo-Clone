import { BoltIcon } from "@/components/icons/BoltIcon";
import { Owl } from "@/components/mascot/Owl";
import { ButtonLink, ProgressBar } from "@/components/ui";
import type { DailyGoalOut } from "@/lib/api/types";
import { dailyGoalMessage } from "./questCopy";

/**
 * The page's pink header card, holding today's daily goal: it is the daily-goal indicator on phones, where the
 * right rail is hidden. The owl perches on its top-right corner.
 */
export function DailyGoalHero({ dailyGoal }: { dailyGoal: DailyGoalOut }) {
  const { goalXp, earnedXp, met } = dailyGoal;
  const shown = Math.min(earnedXp, goalXp);
  return (
    <section className="relative mt-6 rounded-lg bg-(--duo-starfish) p-5 shadow-[0_4px_0_var(--unit-pink-lip)] md:p-6">
      <Owl pose={met ? "celebrate" : "cheer"} size={96} className="absolute -top-7 right-2 md:right-4" />
      <h2 className="text-[22px] leading-[30px] font-extrabold text-on-color-fixed md:text-title">Daily goal</h2>
      <div className="mt-5 rounded-md bg-page p-4">
        <div className="flex items-center gap-3">
          <BoltIcon size={32} className="shrink-0" />
          <ProgressBar
            value={shown / goalXp}
            tone="quest"
            height={18}
            label={`${shown} / ${goalXp} XP`}
            aria-label="Daily goal"
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <p className="text-body text-fg-2">{dailyGoalMessage(dailyGoal)}</p>
          <ButtonLink href="/settings#daily-goal" variant="ghost" size="inline">
            Edit goal
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
