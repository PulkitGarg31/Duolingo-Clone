import { CheckIcon } from "@/components/icons";
import type { QuestsOut } from "@/lib/api/types";
import { RailCard } from "./RailCard";
import { RailQuestRow } from "./RailQuestRow";

/** Today's three quests. The first is always the daily goal ("Earn 20 XP"), the rail's goal indicator. */
export function QuestsCard({ quests }: { quests: QuestsOut }) {
  const ordered = [...quests.quests].sort((a, b) => a.slot - b.slot);
  const allDone = ordered.length > 0 && ordered.every((quest) => quest.completed);
  return (
    <RailCard title="Daily Quests" link={{ label: "View all", href: "/quests" }}>
      {allDone && (
        <p className="mb-4 flex items-center gap-2 text-[15px] leading-5 font-extrabold text-correct-fg">
          <CheckIcon size={16} />
          All Daily Quests complete!
        </p>
      )}
      <ul className="flex flex-col gap-5">
        {ordered.map((quest) => (
          <RailQuestRow key={quest.code} quest={quest} />
        ))}
      </ul>
    </RailCard>
  );
}
