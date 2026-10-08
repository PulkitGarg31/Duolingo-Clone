"use client";

import { useState } from "react";
import { ProfileView } from "@/features/profile/ProfileView";
import { StreakCalendarSection } from "@/features/profile/LearnerActivity";
import { XpWeekChart } from "@/features/profile/XpWeekChart";
import { MonthCalendar } from "@/features/stats/MonthCalendar";
import { compareMonths, monthOf, shiftMonth } from "@/features/stats/streakCalendar";
import { TODAY, activity, learnerProfile, me } from "../fixtures";

/** The learner's own profile, with the XP chart and a pageable streak calendar. */
export default function ProfilePreview() {
  const [month, setMonth] = useState(() => monthOf(TODAY));
  return (
    <ProfileView
      profile={learnerProfile}
      course={me.course}
      activity={
        <>
          <XpWeekChart days={activity} today={TODAY} goalXp={20} />
          <StreakCalendarSection>
            <MonthCalendar
              month={month}
              days={activity}
              today={TODAY}
              canGoBack={compareMonths(month, monthOf(me.user.joinedAt.slice(0, 10))) > 0}
              canGoForward={compareMonths(month, monthOf(TODAY)) < 0}
              onMonthChange={(delta) => setMonth((current) => shiftMonth(current, delta))}
            />
          </StreakCalendarSection>
        </>
      }
    />
  );
}
