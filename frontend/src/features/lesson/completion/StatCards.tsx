"use client";

import { useState } from "react";
import { BoltIcon, ClockIcon, TargetIcon } from "@/components/icons";
import { CountUp } from "@/components/ui/CountUp";
import { formatClock } from "@/lib/format";
import type { LessonSummary, XpPhase } from "@/lib/lesson/celebrations";
import { STAT_LABELS } from "@/lib/lesson/copy";
import { playCelebrationSound } from "./celebrationSound";
import { StatFrame } from "./StatFrame";
import { useCues } from "./useCues";

/** The cards land one after another, 150 ms apart, once the title has settled. */
const CARD_CUES = [500, 650, 800] as const;
const COUNT_MS = 800;
const BONUS_COUNT_MS = 500;

const asPercent = (value: number) => `${value}%`;
const playTick = () => playCelebrationSound("tick");

/** TOTAL XP, time and accuracy, rising in turn; each number counts up once its card lands. */
export function StatCards({ summary }: { summary: LessonSummary }) {
  const cue = useCues(CARD_CUES);
  const { time, accuracy } = summary;
  return (
    <dl className="mt-8 flex w-full max-w-[521px] justify-center gap-[10px] min-[350px]:gap-4">
      <XpStatCard phases={summary.xpPhases} shown={cue >= 1} />
      <StatFrame tone="time" label={time.label} icon={<ClockIcon size={20} />} shown={cue >= 2}>
        {(landed) => <CountUp value={time.seconds} format={formatClock} start={landed} durationMs={COUNT_MS} />}
      </StatFrame>
      <StatFrame tone="accuracy" label={accuracy.label} icon={<TargetIcon size={20} />} shown={cue >= 3}>
        {(landed) => <CountUp value={accuracy.percent} format={asPercent} start={landed} durationMs={COUNT_MS} />}
      </StatFrame>
    </dl>
  );
}

/**
 * TOTAL XP counts the session's own XP, then swaps its label to COMBO while the combo bonus counts on (and to
 * "2X" for a boost), then reads TOTAL XP again.
 */
function XpStatCard({ phases, shown }: { phases: readonly XpPhase[]; shown: boolean }) {
  const [phase, setPhase] = useState(0);
  const [settled, setSettled] = useState(false);
  const current = phases[phase];

  function nextPhase() {
    if (phase < phases.length - 1) setPhase(phase + 1);
    else setSettled(true);
  }

  return (
    <StatFrame
      tone="xp"
      label={settled ? STAT_LABELS.totalXp : current.label}
      icon={<BoltIcon size={20} />}
      shown={shown}
    >
      {(landed) => (
        <CountUp
          value={current.to}
          start={landed}
          durationMs={phase === 0 ? COUNT_MS : BONUS_COUNT_MS}
          onTick={playTick}
          onDone={nextPhase}
        />
      )}
    </StatFrame>
  );
}
