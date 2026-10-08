import { cn } from "@/lib/cn";
import type { StripDay, StripDayState } from "@/lib/lesson/celebrations";
import { DAY_LETTERS } from "@/lib/lesson/copy";
import styles from "./completion.module.css";

interface WeekStripProps {
  days: readonly StripDay[];
  /** The streak number has landed: today's circle pops in and tomorrow's nudges. */
  todayLanded: boolean;
}

/**
 * The weekday strip under the streak number: a card of 34 px circles under their day letters. Today's letter
 * is orange. The heading and the message above and below already say what it shows, so it is hidden from
 * screen readers.
 */
export function WeekStrip({ days, todayLanded }: WeekStripProps) {
  return (
    <div
      aria-hidden="true"
      className="mt-6 w-full max-w-[392px] rounded-lg border-2 border-line bg-page px-4 py-3 max-[359px]:scale-90"
    >
      <ol className="flex justify-between">
        {days.map((day) => (
          <li key={day.date} className="flex w-[34px] flex-col items-center gap-1">
            <span className={cn("text-[16px]/6 font-extrabold", day.isToday ? "text-streak" : "text-fg-3")}>
              {DAY_LETTERS[day.weekday]}
            </span>
            {day.isToday ? (
              <TodayCircle state={day.state} landed={todayLanded} />
            ) : (
              <DayCircle state={day.state} nudge={todayLanded} />
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

const CIRCLE = "grid size-[34px] place-items-center rounded-full";

const STATE_CLASSES: Record<StripDayState, string> = {
  extended: "bg-fox",
  frozen: "bg-macaw",
  empty: "bg-swan",
  nudge: "border-2 border-dashed border-fox bg-page",
};

function DayCircle({ state, nudge }: { state: StripDayState; nudge: boolean }) {
  return (
    <span
      className={cn(
        CIRCLE,
        STATE_CLASSES[state],
        // Tomorrow pulses once, just after today's circle has popped.
        state === "nudge" && nudge && "animate-[nudge_600ms_ease-in-out_400ms]",
      )}
    >
      {(state === "extended" || state === "frozen") && <Check />}
    </span>
  );
}

/** Today waits as an empty circle, then pops into its colour and draws its check. */
function TodayCircle({ state, landed }: { state: StripDayState; landed: boolean }) {
  return (
    <span className={cn(CIRCLE, "bg-swan")}>
      {landed && (
        <span
          className={cn(
            CIRCLE,
            "col-start-1 row-start-1 animate-[day-pop_400ms_var(--ease-spring)_both]",
            STATE_CLASSES[state],
          )}
        >
          {state !== "empty" && <Check drawn />}
        </span>
      )}
    </span>
  );
}

function Check({ drawn = false }: { drawn?: boolean }) {
  return (
    <svg viewBox="0 0 34 34" className="size-[34px]">
      <path
        d="M11 17.6 15.3 21.8 23.2 13.4"
        fill="none"
        className={cn("stroke-on-color-fixed", drawn && `${styles.draw} [animation-delay:300ms]`)}
        strokeWidth={3.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
      />
    </svg>
  );
}
