"use client";

import { useState } from "react";
import type { ISODate } from "@/lib/api/types";
import { useActivity } from "@/lib/queries/hooks";
import { MonthCalendar } from "./MonthCalendar";
import { compareMonths, monthFetchRange, monthOf, shiftMonth } from "./streakCalendar";

interface StreakCalendarCardProps {
  /** The learner's local date. */
  today: ISODate;
  /** The first month that can be shown: the month the learner joined. */
  firstMonthDate: ISODate;
}

/** The streak popover's calendar: opens on the current month and steps back as far as the learner's first month. */
export function StreakCalendarCard({ today, firstMonthDate }: StreakCalendarCardProps) {
  const [month, setMonth] = useState(() => monthOf(today));
  const { from, to } = monthFetchRange(month, today);
  const activity = useActivity(from, to);
  return (
    <MonthCalendar
      month={month}
      days={activity.data?.items ?? []}
      today={today}
      canGoBack={compareMonths(month, monthOf(firstMonthDate)) > 0}
      canGoForward={compareMonths(month, monthOf(today)) < 0}
      onMonthChange={(delta) => setMonth((current) => shiftMonth(current, delta))}
    />
  );
}
