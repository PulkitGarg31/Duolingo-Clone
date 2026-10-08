"use client";

import { CloseIcon } from "@/components/icons/CloseIcon";
import type { ProgressTone } from "@/components/ui/ProgressBar";
import type { SessionOut } from "@/lib/api/types";
import { comboTone } from "./ComboLabel";
import { HeartsCounter } from "./HeartsCounter";
import { LessonProgressBar, type Checkpoint } from "./LessonProgressBar";
import { LivesCounter } from "./LivesCounter";
import { TimedClock, type TimeBonus } from "./TimedClock";

/** Legendary pays its XP only at the very end: no partial credit, so its one checkpoint sits at 100 %. */
const LEGENDARY_XP = 40;
/** Timed practice's milestones, in correct answers. */
const TIMED_MILESTONES = [5, 10, 20] as const;

interface LessonHeaderProps {
  session: SessionOut;
  /** "N IN A ROW" shows from a correct answer until the next CHECK. */
  showCombo: boolean;
  timeBonus: TimeBonus | null;
  onQuit(): void;
  onTimeUp(): void;
}

/** X · progress bar · hearts (lessons), lives (Legendary) or the clock (Timed practice); practice shows none. */
export function LessonHeader({ session, showCombo, timeBonus, onQuit, onTimeUp }: LessonHeaderProps) {
  const { completed, total } = session.progress;
  return (
    <header className="px-4 pt-3 pb-[clamp(4px,1.5vh,24px)] md:pt-4 md:pb-6">
      <div className="mx-auto flex min-h-10 max-w-[1000px] items-center gap-4">
        <button
          type="button"
          aria-label="Quit lesson"
          onClick={onQuit}
          className="-mx-2 grid size-10 shrink-0 cursor-pointer place-items-center rounded-md text-fg-3 hover:text-fg-2 focus-visible:outline-2 focus-visible:outline-focus"
        >
          <CloseIcon size={24} />
        </button>
        <LessonProgressBar
          value={total > 0 ? completed / total : 0}
          tone={barTone(session)}
          combo={session.combo}
          showCombo={showCombo}
          checkpoints={checkpoints(session)}
        />
        <HeaderStatus session={session} timeBonus={timeBonus} onTimeUp={onTimeUp} />
      </div>
    </header>
  );
}

function barTone({ kind, combo }: SessionOut): ProgressTone {
  if (kind === "legendary") return "gold";
  if (kind === "timed") return "beetle";
  return comboTone(combo);
}

function checkpoints({ kind, progress }: SessionOut): Checkpoint[] {
  if (kind === "legendary") {
    return [{ at: 1, label: String(LEGENDARY_XP), reached: progress.total > 0 && progress.completed >= progress.total }];
  }
  if (kind === "timed") {
    return TIMED_MILESTONES.filter((goal) => goal <= progress.total).map((goal) => ({
      at: goal / progress.total,
      label: String(goal),
      reached: progress.completed >= goal,
    }));
  }
  return [];
}

function HeaderStatus({ session, timeBonus, onTimeUp }: Pick<LessonHeaderProps, "session" | "timeBonus" | "onTimeUp">) {
  switch (session.kind) {
    case "lesson":
      return <HeartsCounter hearts={session.hearts.current} />;
    case "legendary":
      return session.lives && <LivesCounter lives={session.lives} />;
    case "timed":
      return session.timer && <TimedClock expiresAt={session.timer.expiresAt} onTimeUp={onTimeUp} bonus={timeBonus} />;
    case "practice":
      // Practice never costs hearts.
      return null;
  }
}
