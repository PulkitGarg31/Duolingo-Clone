"use client";

import { HeartIcon, HeartRefillIcon } from "@/components/icons";
import { cn } from "@/lib/cn";
import { COMPLETION_COPY } from "@/lib/lesson/copy";
import { CelebrationFooter } from "./CelebrationFooter";
import { CelebrationScreen } from "./CelebrationScreen";
import { CelebrationBody, CelebrationTitle } from "./CelebrationText";
import { useCues } from "./useCues";

/** The new heart joins the row once the big heart has popped in. */
const HEART_CUES = [450] as const;

interface HeartEarnedScreenProps {
  /** Hearts after the practice session. */
  hearts: number;
  max: number;
  active: boolean;
  onContinue: () => void;
}

/** "You gained another heart!" after a practice session, with the hearts row filling up by one. */
export function HeartEarnedScreen({ hearts, max, active, onContinue }: HeartEarnedScreenProps) {
  const cue = useCues(HEART_CUES);
  return (
    <CelebrationScreen footer={<CelebrationFooter active={active} onContinue={onContinue} />}>
      <div className="animate-[pop-in_400ms_var(--ease-spring)_both]">
        <HeartRefillIcon size={140} />
      </div>
      <CelebrationTitle className="mt-6 text-fg-strong">{COMPLETION_COPY.heartTitle}</CelebrationTitle>
      <CelebrationBody className="mt-3 max-w-[400px] text-fg-2">{COMPLETION_COPY.heartBody}</CelebrationBody>
      <HeartsRow hearts={hearts} max={max} gained={cue >= 1} />
    </CelebrationScreen>
  );
}

/** One heart per slot: full up to the count, empty after it. The newest heart pops in when `gained`. */
function HeartsRow({ hearts, max, gained }: { hearts: number; max: number; gained: boolean }) {
  return (
    <div className="mt-8 flex gap-2" role="img" aria-label={`${hearts} of ${max} hearts`}>
      {Array.from({ length: max }, (_, slot) => {
        const newest = slot === hearts - 1;
        const full = slot < hearts && (!newest || gained);
        return (
          <span key={slot} className={cn(newest && gained && "animate-[badge-pop_300ms_var(--ease-spring)_both]")}>
            <HeartIcon size={36} variant={full ? "full" : "empty"} />
          </span>
        );
      })}
    </div>
  );
}
