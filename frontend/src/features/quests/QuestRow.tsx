import { CheckIcon } from "@/components/icons/CheckIcon";
import { ProgressBar } from "@/components/ui";
import { QuestGlyph } from "@/features/rail/QuestGlyph";
import type { QuestOut } from "@/lib/api/types";
import { QuestChest } from "./QuestChest";

/**
 * One daily quest: its picture, title and gold progress bar with the reward chest at the end. There is no CLAIM
 * button: the gems are paid when the lesson that completes the quest ends.
 */
export function QuestRow({ quest }: { quest: QuestOut }) {
  const { title, icon, progress, target, rewardGems, completed } = quest;
  return (
    <li className="grid grid-cols-[48px_1fr] items-center gap-4 border-t-2 border-line px-5 py-4 first:border-t-0">
      <QuestGlyph icon={icon} size={48} />
      <div className="min-w-0">
        <h3 className="flex items-center gap-2 text-body font-extrabold text-fg">
          {title}
          {completed && <CheckIcon size={18} title="Complete" className="shrink-0 text-correct-fg" />}
        </h3>
        <div className="relative mt-2 mr-5">
          <ProgressBar value={progress / target} tone="quest" height={18} label={`${progress} / ${target}`} aria-label={title} />
          <span className="absolute top-1/2 -right-5 -translate-y-1/2">
            <QuestChest open={completed} size={40} />
          </span>
        </div>
        <p className="mt-1.5 text-[13px] leading-4 font-extrabold text-gem">{rewardGems} gems</p>
      </div>
    </li>
  );
}
