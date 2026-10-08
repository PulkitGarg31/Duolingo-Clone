"use client";

import { useRef, useState } from "react";
import { Confetti, Owl } from "@/components/mascot";
import { ReviewScorecard, type ReviewItem } from "@/features/lesson/ReviewScorecard";
import type { LessonSummary } from "@/lib/lesson/celebrations";
import { COMPLETION_COPY } from "@/lib/lesson/copy";
import { CelebrationFooter, type FooterAction } from "./CelebrationFooter";
import { CelebrationScreen } from "./CelebrationScreen";
import { CelebrationBody, CelebrationTitle } from "./CelebrationText";
import { StatCards } from "./StatCards";

interface LessonCompleteScreenProps {
  summary: LessonSummary;
  /** No mistakes: the confetti bursts twice. */
  perfect: boolean;
  active: boolean;
  onContinue: () => void;
  /** Called when the scorecard opens. */
  onReview?: () => void;
  /** The session's answers. REVIEW LESSON shows only with them: after a reload they are gone. */
  reviewItems?: readonly ReviewItem[];
}

/** The first screen after a lesson: the cheering owl, the title, an accolade and the three stat cards. */
export function LessonCompleteScreen({
  summary,
  perfect,
  active,
  onContinue,
  onReview,
  reviewItems = [],
}: LessonCompleteScreenProps) {
  const owl = useRef<HTMLDivElement>(null);
  const [reviewing, setReviewing] = useState(false);
  const hasScorecard = reviewItems.length > 0;
  const review: FooterAction | undefined = hasScorecard
    ? {
        label: COMPLETION_COPY.reviewLesson,
        onClick: () => {
          setReviewing(true);
          onReview?.();
        },
      }
    : undefined;

  return (
    <CelebrationScreen footer={<CelebrationFooter active={active} onContinue={onContinue} secondary={review} />}>
      <div ref={owl} className="w-40 md:w-[200px]">
        <Owl pose="celebrate" size={200} className="h-auto w-full" />
      </div>
      <CelebrationTitle className="mt-6 text-bee">{summary.title}</CelebrationTitle>
      {summary.accolade && <CelebrationBody className="mt-6 max-w-[440px] text-fg-3">{summary.accolade}</CelebrationBody>}
      <StatCards summary={summary} />
      <Confetti variant="burst" origin={owl} bursts={perfect ? 2 : 1} />
      {hasScorecard && <ReviewScorecard open={reviewing} onOpenChange={setReviewing} items={reviewItems} />}
    </CelebrationScreen>
  );
}
