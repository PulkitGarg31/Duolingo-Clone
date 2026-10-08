import { ChevronIcon } from "@/components/icons";
import type { ActivityDayOut, ISODate } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatMonthYear } from "@/lib/format";
import { buildMonthGrid, type CalendarDay, type CalendarMonth } from "./streakCalendar";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"] as const;
const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

interface MonthCalendarProps {
  month: CalendarMonth;
  /** The month's activity; days arrive empty while it loads, so the dates show at once. */
  days: readonly ActivityDayOut[];
  today: ISODate;
  canGoBack: boolean;
  canGoForward: boolean;
  onMonthChange: (delta: -1 | 1) => void;
}

/**
 * A month of streak history: consecutive streak days in a week row sit on one continuous band, run starts and
 * an extended today are filled orange circles, and frozen days are blue with a drip.
 */
export function MonthCalendar({ month, days, today, canGoBack, canGoForward, onMonthChange }: MonthCalendarProps) {
  const weeks = buildMonthGrid(month, days, today);
  const title = formatMonthYear(`${month.year}-${String(month.month).padStart(2, "0")}-01`);
  return (
    <div className="rounded-lg border-2 border-line p-4">
      <div className="flex items-center justify-between">
        <MonthStep direction="left" label="Previous month" disabled={!canGoBack} onClick={() => onMonthChange(-1)} />
        <h3 className="text-[17px] leading-5 font-extrabold text-fg">{title}</h3>
        <MonthStep direction="right" label="Next month" disabled={!canGoForward} onClick={() => onMonthChange(1)} />
      </div>
      <table className="mt-3 w-full table-fixed border-collapse">
        <thead>
          <tr>
            {WEEKDAYS.map((initial, index) => (
              <th key={WEEKDAY_NAMES[index]} scope="col" abbr={WEEKDAY_NAMES[index]} className="pb-1 text-caption text-fg-3">
                {initial}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week) => (
            <tr key={week.find(Boolean)?.date}>
              {week.map((day, index) => (
                <td key={day?.date ?? `pad-${index}`} className="p-0 py-0.5">
                  {day && <DayCell day={day} />}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MonthStep({
  direction,
  label,
  disabled,
  onClick,
}: {
  direction: "left" | "right";
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="grid size-8 cursor-pointer place-items-center rounded-sm text-fg-3 hover:bg-subtle focus-visible:outline-2 focus-visible:outline-focus disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent"
    >
      <ChevronIcon direction={direction} size={20} />
    </button>
  );
}

/** Filled circle colours by mark; "streak" days sit on the band without a circle. */
const CIRCLE: Partial<Record<CalendarDay["mark"], string>> = {
  start: "bg-streak",
  today: "bg-streak",
  frozen: "bg-freeze",
};

function DayCell({ day }: { day: CalendarDay }) {
  const circle = CIRCLE[day.mark];
  const onBand = day.mark !== "none";
  return (
    <div className="relative flex h-9 items-center justify-center">
      {onBand && (
        <span
          aria-hidden="true"
          className={cn(
            "absolute inset-y-0 bg-(--c-streak-band)",
            day.joinsPrevious ? "left-0" : "left-[calc(50%-18px)] rounded-l-full",
            day.joinsNext ? "right-0" : "right-[calc(50%-18px)] rounded-r-full",
          )}
        />
      )}
      <span
        className={cn(
          "relative grid size-9 place-items-center rounded-full text-[15px] leading-none font-extrabold tabular-nums",
          circle ? cn(circle, "text-on-color-fixed") : dayTextColour(day),
        )}
      >
        {day.day}
        {day.mark === "frozen" && (
          <span aria-hidden="true" className="absolute -bottom-1 left-1/2 h-2 w-1.5 -translate-x-1/2 rounded-b-full bg-freeze" />
        )}
      </span>
      <span className="sr-only">{dayDescription(day)}</span>
    </div>
  );
}

function dayTextColour(day: CalendarDay): string {
  if (day.mark === "streak") return "text-streak";
  if (day.isFuture) return "text-fg-3";
  if (day.isToday) return "text-fg-strong";
  return "text-fg-2/60";
}

function dayDescription(day: CalendarDay): string {
  switch (day.mark) {
    case "frozen":
      return "Streak Freeze used";
    case "none":
      return day.isToday ? "today" : "";
    default:
      return day.isToday ? "today, streak extended" : "streak day";
  }
}
