"use client";

import type { ReactNode } from "react";
import { StreakCalendarCard } from "@/features/stats/StreakCalendarCard";
import type { ISODateTime, MeOut } from "@/lib/api/types";
import { useActivity } from "@/lib/queries/hooks";
import { addDays } from "./weekChart";
import { XpWeekChart } from "./XpWeekChart";

interface LearnerActivityProps {
  me: MeOut;
  /** The calendar never pages back past the month the learner joined. */
  joinedAt: ISODateTime;
}

/**
 * The learner's own XP chart and streak calendar (bots have neither). The calendar is the streak popover's,
 * so both always draw a month the same way.
 */
export function LearnerActivity({ me, joinedAt }: LearnerActivityProps) {
  const today = me.localDate;
  const week = useActivity(addDays(today, -6), today);
  return (
    <>
      <XpWeekChart days={week.data?.items} today={today} goalXp={me.dailyGoal.goalXp} />
      <StreakCalendarSection>
        <StreakCalendarCard today={today} firstMonthDate={joinedAt.slice(0, 10)} />
      </StreakCalendarSection>
    </>
  );
}

/** The "Streak calendar" heading over a month calendar. */
export function StreakCalendarSection({ children }: { children: ReactNode }) {
  return (
    <section aria-labelledby="streak-calendar-title">
      <h2 id="streak-calendar-title" className="mb-4 text-heading text-fg-strong">
        Streak calendar
      </h2>
      {children}
    </section>
  );
}
