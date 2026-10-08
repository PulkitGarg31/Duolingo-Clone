import { LegendaryTrophyIcon } from "@/components/icons/LegendaryTrophyIcon";
import { Owl } from "@/components/mascot/Owl";
import type { DailyGoalOut, QuestsOut } from "@/lib/api/types";
import { ComingSoonQuestCard } from "./ComingSoonQuestCard";
import { DailyGoalHero } from "./DailyGoalHero";
import { DailyQuestsSection } from "./DailyQuestsSection";
import { monthName } from "./questCopy";

export interface QuestsViewProps {
  quests: QuestsOut;
  dailyGoal: DailyGoalOut;
  /** Called when the day rolls over and today's quests expire. */
  onReset?: () => void;
}

/** Two grey owls high-fiving: the picture for team quests. */
function HighFivingOwls() {
  return (
    <span className="flex grayscale">
      <Owl pose="wave" size={48} />
      <span className="-ml-3 -scale-x-100">
        <Owl pose="wave" size={48} />
      </span>
    </span>
  );
}

/** The quests page: the daily goal first, today's quests, then the quest types that are still to come. */
export function QuestsView({ quests, dailyGoal, onReset }: QuestsViewProps) {
  return (
    <div className="mx-auto w-full max-w-[592px] px-4 pt-4 pb-12 lg:px-0 lg:pt-6">
      <h1 className="sr-only">Quests</h1>
      <DailyGoalHero dailyGoal={dailyGoal} />
      <DailyQuestsSection quests={quests} onReset={onReset} />
      <div className="mt-10 grid grid-cols-1 gap-4">
        <ComingSoonQuestCard
          art={<LegendaryTrophyIcon size={56} className="grayscale" />}
          title={`${monthName(quests.localDate)} Quest`}
          body="Monthly challenges unlock soon!"
          feature="monthly challenges"
        />
        <ComingSoonQuestCard
          art={<HighFivingOwls />}
          title="Friends Quest"
          body="Team up with a friend to complete quests together."
          feature="Friends Quests"
        />
      </div>
    </div>
  );
}
