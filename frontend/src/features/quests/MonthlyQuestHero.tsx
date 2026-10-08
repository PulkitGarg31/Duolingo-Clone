"use client";

import { ClockIcon } from "@/components/icons/ClockIcon";
import { LegendaryTrophyIcon } from "@/components/icons/LegendaryTrophyIcon";
import { Owl } from "@/components/mascot/Owl";
import { ComingSoonPill } from "@/components/ui";
import { useComingSoon } from "@/features/shell/ComingSoon";
import type { ISODate, ISODateTime } from "@/lib/api/types";
import { formatCountdown } from "@/lib/format";
import { useCountdown } from "@/lib/time/serverClock";
import { monthEndsAt, monthName } from "./questCopy";

interface MonthlyQuestHeroProps {
  /** Today in the learner's time zone, from the quests. */
  localDate: ISODate;
  /** The next local midnight, from the quests. */
  resetsAt: ISODateTime;
  /** Today's daily goal is met: the owl celebrates. */
  goalMet: boolean;
}

/**
 * The page's pink header: this month's quest and the days left in it. Monthly challenges are not built, so the
 * white card inside says so and opens Coming soon. The owl holds up a trophy on the top-right corner.
 */
export function MonthlyQuestHero({ localDate, resetsAt, goalMet }: MonthlyQuestHeroProps) {
  const showComingSoon = useComingSoon();
  const msLeft = useCountdown(monthEndsAt(localDate, resetsAt));
  return (
    <section className="relative mt-6 rounded-lg bg-(--duo-starfish) p-5 text-on-color-fixed shadow-[0_4px_0_var(--unit-pink-lip)] md:p-6">
      <span aria-hidden="true" className="absolute -top-7 right-2 size-24 md:right-4">
        <Owl pose={goalMet ? "celebrate" : "cheer"} size={96} />
        <LegendaryTrophyIcon size={40} className="absolute bottom-0 -left-4" />
      </span>
      <h2 className="pr-28 text-[22px]/[30px] font-extrabold sm:pr-0 md:text-title">{monthName(localDate)} Quest</h2>
      <p className="mt-1 flex items-center gap-1.5 text-label uppercase opacity-80">
        <ClockIcon size={18} />
        <span>
          <span className="sr-only">Ends in </span>
          {formatCountdown(msLeft)}
        </span>
      </p>
      <button
        type="button"
        onClick={() => showComingSoon("monthly challenges")}
        className="mt-5 flex w-full cursor-pointer flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-md bg-page p-4 text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-on-color-fixed [@media(hover:hover)]:hover:bg-subtle"
      >
        <span className="text-body font-extrabold text-fg">Monthly challenges unlock soon!</span>
        <ComingSoonPill />
      </button>
    </section>
  );
}
