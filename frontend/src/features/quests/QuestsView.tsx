import { Owl } from "@/components/mascot/Owl";
import type { DailyGoalOut, QuestsOut } from "@/lib/api/types";
import { ComingSoonQuestCard } from "./ComingSoonQuestCard";
import { DailyQuestsSection } from "./DailyQuestsSection";
import { MonthlyQuestHero } from "./MonthlyQuestHero";

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

/** The quests page: this month's quest, today's quests, then team quests, which are still to come. */
export function QuestsView({ quests, dailyGoal, onReset }: QuestsViewProps) {
  return (
    <div className="mx-auto w-full max-w-[592px] px-4 pt-4 pb-12 lg:px-0 lg:pt-6">
      <h1 className="sr-only">Quests</h1>
      <MonthlyQuestHero localDate={quests.localDate} resetsAt={quests.resetsAt} goalMet={dailyGoal.met} />
      <DailyQuestsSection quests={quests} onReset={onReset} />
      <div className="mt-10">
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
