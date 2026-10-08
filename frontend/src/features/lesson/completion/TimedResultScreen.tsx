"use client";

import type { CSSProperties } from "react";
import { CountUp } from "@/components/ui/CountUp";
import type { CompletionOut } from "@/lib/api/types";
import { timedResultCopy } from "@/lib/lesson/copy";
import { CelebrationFooter } from "./CelebrationFooter";
import { CelebrationScreen } from "./CelebrationScreen";
import { playCelebrationSound } from "./celebrationSound";
import { CelebrationBody, CelebrationTitle } from "./CelebrationText";
import styles from "./completion.module.css";
import { useCues } from "./useCues";

/** Size (px), place and head start (s) of each bubble drifting up the purple screen. */
const BUBBLES = [
  { size: 120, left: "6%", top: "16%", delay: 0 },
  { size: 64, left: "24%", top: "68%", delay: -6 },
  { size: 160, left: "70%", top: "10%", delay: -12 },
  { size: 48, left: "86%", top: "58%", delay: -3 },
  { size: 88, left: "58%", top: "78%", delay: -15 },
  { size: 40, left: "40%", top: "6%", delay: -9 },
  { size: 72, left: "10%", top: "44%", delay: -17 },
] as const;

/** The circle pops in (300 ms), then the XP counts up inside it. */
const TIMED_CUES = [300] as const;

interface TimedResultScreenProps {
  completion: CompletionOut;
  active: boolean;
  onContinue: () => void;
}

/** The end of a timed run: the XP won counting up in a circle on the purple timed-practice screen. */
export function TimedResultScreen({ completion, active, onContinue }: TimedResultScreenProps) {
  const cue = useCues(TIMED_CUES);
  const xp = completion.xp.total;
  const copy = timedResultCopy(xp, completion.timed?.correct ?? 0);
  return (
    <CelebrationScreen
      tone="purple"
      backdrop={<Bubbles />}
      footer={<CelebrationFooter active={active} onContinue={onContinue} variant="white" />}
    >
      <div className="grid size-40 animate-pop-in place-items-center rounded-full bg-on-color-fixed/20">
        <CountUp
          value={xp}
          start={cue >= 1}
          onTick={() => playCelebrationSound("tick")}
          className="text-[56px]/none font-black text-on-color-fixed md:text-[70px]"
        />
      </div>
      <CelebrationTitle className="mt-8 text-on-color-fixed">{copy.title}</CelebrationTitle>
      <CelebrationBody className="mt-3 max-w-[400px] text-on-color-fixed/80">{copy.body}</CelebrationBody>
    </CelebrationScreen>
  );
}

function Bubbles() {
  return BUBBLES.map(({ size, left, top, delay }) => {
    const style: CSSProperties & Record<"--size", string> = {
      "--size": `${size}px`,
      left,
      top,
      animationDelay: `${delay}s`,
    };
    return <span key={left} className={styles.bubble} style={style} />;
  });
}
