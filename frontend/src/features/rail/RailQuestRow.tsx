"use client";

import { motion } from "motion/react";
import { ChestIcon } from "@/components/icons";
import { ProgressBar } from "@/components/ui";
import { useValueChange } from "@/features/shell/useValueChange";
import type { QuestOut } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { QuestGlyph } from "./QuestGlyph";

/**
 * One daily quest: its icon, title and a gold bar ending in a chest. The chest opens with a bounce when the
 * quest completes (its reward is paid automatically by the lesson that finished it).
 */
export function RailQuestRow({ quest }: { quest: QuestOut }) {
  const completion = useValueChange(quest.completed);
  const justCompleted = completion.previous === false && quest.completed;
  return (
    <li className="grid grid-cols-[40px_1fr] items-center gap-4">
      <QuestGlyph icon={quest.icon} size={40} />
      <div className="min-w-0">
        <p className="mb-2 text-[17px] leading-5 font-extrabold text-fg">{quest.title}</p>
        <div className="relative mr-3">
          <ProgressBar
            value={quest.progress / quest.target}
            tone="quest"
            height={18}
            label={`${quest.progress} / ${quest.target}`}
            aria-label={quest.title}
          />
          <motion.span
            key={completion.count}
            aria-hidden="true"
            className={cn(
              "absolute top-1/2 -right-3 z-[1] -translate-y-1/2",
              quest.completed && "drop-shadow-[0_0_4px_rgb(255_200_0/0.7)]",
            )}
            initial={justCompleted ? { scale: 1 } : false}
            animate={justCompleted ? { scale: [1, 1.2, 1] } : undefined}
            transition={{ duration: 0.4 }}
          >
            <ChestIcon variant={quest.completed ? "open" : "closed"} size={32} />
          </motion.span>
        </div>
      </div>
    </li>
  );
}
