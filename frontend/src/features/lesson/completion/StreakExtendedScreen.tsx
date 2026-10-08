"use client";

import { useRef } from "react";
import { Confetti } from "@/components/mascot";
import type { CompletionStreak } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { weekStrip } from "@/lib/lesson/celebrations";
import { COMPLETION_COPY, streakBody } from "@/lib/lesson/copy";
import { CelebrationFooter } from "./CelebrationFooter";
import { CelebrationScreen } from "./CelebrationScreen";
import { useSoundOnce } from "./celebrationSound";
import { CelebrationBody, TITLE_XL } from "./CelebrationText";
import { StreakCount } from "./StreakCount";
import { StreakFlame } from "./StreakFlame";
import { useCues } from "./useCues";
import { WeekStrip } from "./WeekStrip";

/** The flame lands at 600 ms; 600 ms later the number rolls (300 ms); then today's circle pops. */
const STREAK_CUES = [600, 1200, 1500] as const;

interface StreakExtendedScreenProps {
  streak: CompletionStreak;
  active: boolean;
  onContinue: () => void;
}

/** "14 day streak!": the flame ignites, the number rolls on by one, and today joins the weekday strip. */
export function StreakExtendedScreen({ streak, active, onContinue }: StreakExtendedScreenProps) {
  const cue = useCues(STREAK_CUES);
  const flame = useRef<HTMLDivElement>(null);
  useSoundOnce("streak");
  const today = streak.week.at(-1)?.date ?? "";

  return (
    <CelebrationScreen footer={<CelebrationFooter active={active} onContinue={onContinue} />}>
      <div ref={flame}>
        <StreakFlame lit={cue >= 1} />
      </div>
      <h1 className="mt-4 flex flex-col items-center">
        <StreakCount from={streak.before} to={streak.after} rolled={cue >= 2} />
        <span className="sr-only">{streak.after} </span>
        <span className={cn(TITLE_XL, "text-streak")}>{COMPLETION_COPY.dayStreak}</span>
      </h1>
      <WeekStrip days={weekStrip(streak.week, streak.after)} todayLanded={cue >= 3} />
      <CelebrationBody className="mt-6 max-w-[360px] text-fg-2">
        {streakBody(streak.after, streak.milestone, today)}
      </CelebrationBody>
      {/* Milestones get confetti from the screen's corners (the sparkle that replaces it rings the flame). */}
      {streak.milestone && cue >= 3 && <Confetti variant="cannons" origin={flame} />}
    </CelebrationScreen>
  );
}
