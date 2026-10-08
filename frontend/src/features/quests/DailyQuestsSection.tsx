import { CheckIcon } from "@/components/icons/CheckIcon";
import type { QuestsOut } from "@/lib/api/types";
import { questsStatus } from "./questCopy";
import { QuestRow } from "./QuestRow";
import { ResetCountdown } from "./ResetCountdown";

interface DailyQuestsSectionProps {
  quests: QuestsOut;
  onReset?: () => void;
}

/** Today's three quests, the daily goal first, with the time until they refresh and how many are done. */
export function DailyQuestsSection({ quests, onReset }: DailyQuestsSectionProps) {
  const ordered = [...quests.quests].sort((a, b) => a.slot - b.slot);
  const allDone = ordered.length > 0 && quests.completedCount >= ordered.length;
  const status = questsStatus(quests.completedCount, ordered.length);
  return (
    <section className="mt-10">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-[22px]/7 font-extrabold text-fg-strong md:text-heading">Daily Quests</h2>
        <ResetCountdown resetsAt={quests.resetsAt} onReset={onReset} />
      </div>
      <p className="mt-1 text-body text-fg-2 md:text-subtitle">Complete quests to earn rewards! Quests refresh every day.</p>
      {allDone ? (
        <p className="mt-4 flex items-center gap-2 rounded-md bg-correct px-4 py-3 text-body font-extrabold text-correct-fg">
          <CheckIcon size={18} />
          {status}
        </p>
      ) : (
        status && <p className="mt-3 text-small text-fg-2">{status}</p>
      )}
      <ul className="mt-4 rounded-lg border-2 border-line">
        {ordered.map((quest) => (
          <QuestRow key={quest.code} quest={quest} />
        ))}
      </ul>
    </section>
  );
}
