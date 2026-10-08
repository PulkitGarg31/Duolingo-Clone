import type { KeyboardEvent } from "react";
import { List, ListItem } from "@/components/ui";
import { Owl, SpeechBubble } from "@/components/mascot";
import type { DailyGoalXp } from "@/lib/api/types";

const GOALS: readonly { xp: DailyGoalXp; name: string }[] = [
  { xp: 10, name: "Casual" },
  { xp: 20, name: "Regular" },
  { xp: 30, name: "Serious" },
  { xp: 50, name: "Intense" },
];

/** Arrow keys move the choice, as in any radio group. */
const STEPS: Partial<Record<string, number>> = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };

interface DailyGoalPickerProps {
  value: DailyGoalXp;
  onChange: (goal: DailyGoalXp) => void;
}

/** The owl asks, and the learner picks one of four goals from 10 to 50 XP a day. */
export function DailyGoalPicker({ value, onChange }: DailyGoalPickerProps) {
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const step = STEPS[event.key];
    if (step === undefined) return;
    event.preventDefault();
    const current = GOALS.findIndex((goal) => goal.xp === value);
    const next = (current + step + GOALS.length) % GOALS.length;
    onChange(GOALS[next].xp);
    event.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]')[next]?.focus();
  }

  return (
    <div>
      <div className="flex items-center gap-3">
        <Owl pose="idle" size={72} className="shrink-0" />
        <SpeechBubble tail="left" className="mb-3 text-body">
          What&apos;s your daily learning goal?
        </SpeechBubble>
      </div>
      <List role="radiogroup" aria-label="Daily goal" className="mt-4" onKeyDown={handleKeyDown}>
        {GOALS.map(({ xp, name }) => {
          const selected = xp === value;
          return (
            <ListItem
              key={xp}
              role="radio"
              aria-checked={selected}
              tabIndex={selected ? 0 : -1}
              selected={selected}
              checkBadge
              detail={`${xp} XP per day`}
              onClick={() => onChange(xp)}
            >
              <span className="font-extrabold">{name}</span>
            </ListItem>
          );
        })}
      </List>
    </div>
  );
}
