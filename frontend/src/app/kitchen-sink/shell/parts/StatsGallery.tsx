"use client";

import { useState } from "react";
import { CourseMenuView } from "@/features/shell/CourseMenu";
import { GemsPopover } from "@/features/stats/GemsPopover";
import { HeartsPopover } from "@/features/stats/HeartsPopover";
import { MonthCalendar } from "@/features/stats/MonthCalendar";
import { StatsBar } from "@/features/stats/StatsBar";
import { StatsBarSkeleton } from "@/features/stats/StatsBarSkeleton";
import { StreakPopover } from "@/features/stats/StreakPopover";
import { XpPopover } from "@/features/stats/XpPopover";
import type { MeOut } from "@/lib/api/types";
import { ACTIVITY_OCTOBER_EXTENDED, ACTIVITY_SEPTEMBER, COURSES, ME, ME_VARIANTS } from "../fixtures";
import { Example, GallerySection, PopoverFrame } from "./GallerySection";

const noop = () => undefined;

function heartsOf(me: MeOut, current: number): MeOut["hearts"] {
  return current === me.hearts.max ? { ...me.hearts, current, nextHeartAt: null, fullAt: null } : { ...me.hearts, current };
}

/** The stats row in its three placements and every stats popover's content. */
export function StatsGallery() {
  const [septemberShown, setSeptemberShown] = useState(false);
  return (
    <>
      <GallerySection title="Stats row">
        <Example label="Right rail · 368 px">
          <StatsBar me={ME} placement="rail" className="w-[368px]" />
        </Example>
        <Example label="Tablet header · 600 px">
          <StatsBar me={ME_VARIANTS.extended} placement="header" className="w-[600px]" />
        </Example>
        <Example label="Phone top bar · 320 px">
          <div className="w-[320px] rounded-md border-2 border-line px-2.5 py-1">
            <StatsBar me={ME_VARIANTS.outOfHearts} placement="topbar" />
          </div>
        </Example>
        <Example label="Loading">
          <StatsBarSkeleton className="w-[368px]" />
        </Example>
      </GallerySection>

      <GallerySection title="Streak">
        <Example label="Not extended today">
          <PopoverFrame width={380}>
            <StreakPopover streak={ME.streak} today={ME.localDate} joinedOn="2026-09-08" onClose={noop} />
          </PopoverFrame>
        </Example>
        <Example label="Extended today">
          <PopoverFrame width={380}>
            <StreakPopover streak={ME_VARIANTS.extended.streak} today={ME.localDate} joinedOn="2026-09-08" onClose={noop} />
          </PopoverFrame>
        </Example>
        <Example label="Frozen yesterday">
          <PopoverFrame width={380}>
            <StreakPopover streak={ME_VARIANTS.outOfHearts.streak} today={ME.localDate} joinedOn="2026-09-08" onClose={noop} />
          </PopoverFrame>
        </Example>
        <Example label="Calendar: today extended / September">
          <div className="flex w-[348px] flex-col gap-4">
            <MonthCalendar
              month={septemberShown ? { year: 2026, month: 9 } : { year: 2026, month: 10 }}
              days={septemberShown ? ACTIVITY_SEPTEMBER.items : ACTIVITY_OCTOBER_EXTENDED.items}
              today="2026-10-08"
              canGoBack={!septemberShown}
              canGoForward={septemberShown}
              onMonthChange={(delta) => setSeptemberShown(delta < 0)}
            />
          </div>
        </Example>
      </GallerySection>

      <GallerySection title="XP, gems and courses">
        <Example label="Daily goal: 0 / 20">
          <PopoverFrame width={320}>
            <XpPopover totalXp={ME.xp.total} dailyGoal={ME.dailyGoal} onClose={noop} />
          </PopoverFrame>
        </Example>
        <Example label="Daily goal met">
          <PopoverFrame width={320}>
            <XpPopover totalXp={ME_VARIANTS.extended.xp.total} dailyGoal={ME_VARIANTS.extended.dailyGoal} onClose={noop} />
          </PopoverFrame>
        </Example>
        <Example label="Gems">
          <PopoverFrame width={320}>
            <GemsPopover gems={ME.gems} onClose={noop} />
          </PopoverFrame>
        </Example>
        <Example label="My courses">
          <PopoverFrame width={320}>
            <CourseMenuView courses={COURSES.items} currentCourseId={1} onCurrent={noop} onComingSoon={noop} />
          </PopoverFrame>
        </Example>
      </GallerySection>

      <GallerySection title="Hearts">
        {[4, 5, 0].map((current) => (
          <Example key={current} label={`${current} of 5 hearts`}>
            <PopoverFrame width={380} className="px-3">
              <HeartsPopover
                hearts={heartsOf(ME, current)}
                gems={current === 0 ? 120 : ME.gems}
                refilling={false}
                practicing={false}
                onRefill={noop}
                onPractice={noop}
                onUnlimited={noop}
              />
            </PopoverFrame>
          </Example>
        ))}
      </GallerySection>
    </>
  );
}
