import { Skeleton } from "@/components/ui";
import type { ActivityDayOut, ISODate } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatShortDate, formatTotal } from "@/lib/format";
import { buildWeek, type WeekChart } from "./weekChart";

interface XpWeekChartProps {
  /** The activity of the last seven days; undefined while it loads. */
  days: readonly ActivityDayOut[] | undefined;
  today: ISODate;
  /** The current daily goal, drawn as the dashed line. */
  goalXp: number;
}

/** "XP this week": one bar per day, green when the day's goal was met, under a dashed daily-goal line. */
export function XpWeekChart({ days, today, goalXp }: XpWeekChartProps) {
  const week = days ? buildWeek(days, today, goalXp) : null;
  return (
    <section aria-labelledby="xp-week-title">
      <h2 id="xp-week-title" className="text-heading text-fg-strong">
        XP this week
      </h2>
      <div className="mt-4 rounded-lg border-2 border-line p-4">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          {week ? (
            <p className="text-card-title text-fg-strong tabular-nums">{formatTotal(week.total)} XP</p>
          ) : (
            <Skeleton className="h-6 w-20 rounded-md" />
          )}
          <p className="flex items-center gap-2 text-small text-fg-2">
            <span aria-hidden="true" className="w-5 border-t-2 border-dashed border-xp" />
            Daily goal: {goalXp} XP
          </p>
        </div>
        {week ? <Bars week={week} goalXp={goalXp} /> : <Skeleton className="mt-4 h-[144px] rounded-md" />}
      </div>
    </section>
  );
}

function Bars({ week, goalXp }: { week: WeekChart; goalXp: number }) {
  const summary = week.bars.map((bar) => `${formatShortDate(bar.date)}: ${bar.xp} XP`).join(", ");
  return (
    <div role="img" aria-label={`XP per day. ${summary}. Daily goal ${goalXp} XP.`} className="mt-4">
      <div className="relative h-[120px]">
        <ol className="absolute inset-0 grid grid-cols-7">
          {week.bars.map((bar) => (
            <li key={bar.date} className="flex items-end justify-center">
              <span
                title={`${formatShortDate(bar.date)}: ${bar.xp} XP`}
                className={cn("w-6 rounded-t-[6px] transition-[height] duration-400", bar.goalMet ? "bg-fill" : "bg-track")}
                style={{ height: `${bar.ratio * 100}%` }}
              />
            </li>
          ))}
        </ol>
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 border-t-2 border-dashed border-xp"
          style={{ bottom: `${week.goalRatio * 100}%` }}
        />
      </div>
      <ol aria-hidden="true" className="mt-2 grid grid-cols-7 border-t-2 border-line pt-2 text-center">
        {week.bars.map((bar) => (
          <li key={bar.date} className={cn("text-caption", bar.isToday ? "text-streak" : "text-fg-3")}>
            {bar.initial}
          </li>
        ))}
      </ol>
    </div>
  );
}
