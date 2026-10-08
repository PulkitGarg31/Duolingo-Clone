"use client";

import type { ReactNode } from "react";
import { CompletionSequence } from "@/features/lesson/completion/CompletionSequence";
import type { ReviewItem } from "@/features/lesson/ReviewScorecard";
import type { SessionItemOut } from "@/lib/api/types";
import { describeAnswer } from "@/lib/lesson/answerDraft";
import { isDraftComplete } from "@/lib/lesson/answerPayload";
import { shownItem, type AnswerRecord, type LessonState, type Phase } from "@/lib/lesson/lessonMachine";
import { CoachSlide } from "./body/CoachSlide";
import { ErrorNotice } from "./body/ErrorNotice";
import { ExerciseFrame } from "./body/ExerciseFrame";
import { ActionFooter, CheckFooter } from "./footer/CheckFooter";
import { FeedbackBar } from "./footer/FeedbackBar";
import { feedbackCopy } from "./footer/feedbackCopy";
import { LessonHeader } from "./header/LessonHeader";
import type { TimeBonus } from "./header/TimedClock";
import { LessonKeyboard, type KeyboardScreen } from "./keyboard/LessonKeyboard";
import { LegendaryFailedModal } from "./modals/LegendaryFailedModal";
import { OutOfHeartsModal } from "./modals/OutOfHeartsModal";
import { QuitConfirmModal } from "./modals/QuitConfirmModal";
import type { LessonActions, LessonAudio, LessonPending } from "./playerTypes";

export interface LessonScreenProps {
  state: LessonState;
  /** The learner's gems for the refill and Legendary buttons, or null while unknown. */
  gems: number | null;
  audio: LessonAudio;
  actions: LessonActions;
  pending: LessonPending;
}

/**
 * The lesson player as a pure view of the lesson state: header, the exercise (or a coach slide), the footer
 * or the feedback bar, and the modals. After the lesson it hands the screen to the celebration sequence.
 */
export function LessonScreen({ state, gems, audio, actions, pending }: LessonScreenProps) {
  const { phase, session } = state;
  if (phase.name === "celebrating") {
    return (
      <LessonKeyboard screen="celebration" onPrimary={actions.nextCelebration} onQuit={actions.openQuit} onReplay={actions.replay}>
        <CompletionSequence
          completion={phase.completion}
          steps={phase.steps}
          index={phase.index}
          onNext={actions.nextCelebration}
          reviewItems={state.reviewable && state.answers.length > 0 ? state.answers.map(toReviewItem) : undefined}
        />
      </LessonKeyboard>
    );
  }

  if (phase.name === "exiting") {
    // On the way out (after the last celebration, say) the lesson must not flash back: only the CONTINUE
    // that was pressed stays, with its loading dots, until the next page replaces the player.
    return (
      <div className="min-h-dvh bg-page">
        <div className="fixed inset-x-0 bottom-0 z-(--z-footer)">
          <ActionFooter label="Continue" onClick={() => undefined} loading />
        </div>
      </div>
    );
  }

  const item = phase.name === "coach" || phase.name === "error" ? undefined : shownItem(state);
  return (
    <LessonKeyboard screen={keyboardScreen(state)} onPrimary={() => primaryAction(phase, actions)} onQuit={actions.openQuit} onReplay={actions.replay}>
      <div className="grid min-h-dvh grid-rows-[auto_1fr] bg-page">
        <LessonHeader
          session={session}
          showCombo={phase.name !== "checking"}
          timeBonus={timeBonus(state, item)}
          onQuit={actions.openQuit}
          onTimeUp={actions.timeUp}
        />
        {/* Clipped sideways: an exercise sliding in from the right would otherwise widen a phone's page. */}
        <main className="flex flex-col items-center overflow-x-clip px-4 pb-[140px] md:pb-[164px]">
          <div className="grid w-full max-w-[600px] flex-1 content-start md:min-h-[450px] md:content-center">
            {phase.name === "coach" && <CoachSlide message={phase.message} />}
            {phase.name === "error" && <ErrorNotice error={phase.error} />}
            {item && (
              <ExerciseFrame
                key={item.id}
                item={item}
                draft={state.draft}
                onDraft={actions.draft}
                locked={phase.name !== "answering"}
                hintsEnabled={session.rules.hintsEnabled}
                onAutoSubmit={actions.check}
                onTap={actions.tap}
                audio={{ available: audio.available, playing: audio.promptPlaying, play: audio.playPrompt, speak: audio.speak }}
                allowKeyboard={session.kind !== "timed"}
                onCantListen={actions.cantListen}
              />
            )}
          </div>
        </main>
      </div>
      <div className="fixed inset-x-0 bottom-0 z-(--z-footer)">
        <Footer state={state} item={item} actions={actions} />
      </div>
      <QuitConfirmModal
        open={state.quitOpen}
        quitting={pending.quitting}
        onKeepLearning={actions.cancelQuit}
        onEndSession={actions.endSession}
      />
      <OutOfHeartsModal
        open={phase.name === "blocked"}
        price={session.hearts.refillPriceGems}
        gems={gems}
        refilling={pending.refilling}
        leaving={pending.quitting}
        onRefill={actions.refill}
        onNoThanks={actions.noThanks}
      />
      <LegendaryFailedModal
        open={phase.name === "failed"}
        gems={gems}
        restarting={pending.restarting}
        onTryAgain={actions.tryAgain}
        onNoThanks={actions.leave}
      />
    </LessonKeyboard>
  );
}

function Footer({ state, item, actions }: { state: LessonState; item: SessionItemOut | undefined; actions: LessonActions }): ReactNode {
  const { phase, draft } = state;
  switch (phase.name) {
    case "feedback":
      return item ? (
        <FeedbackBar
          copy={feedbackCopy(phase.result, describeAnswer(item.exercise, draft), item.exercise.type)}
          onContinue={actions.continue}
          onReport={actions.report}
        />
      ) : null;
    case "coach":
      return <ActionFooter label="Continue" onClick={actions.continue} />;
    case "error":
      return <ActionFooter label="Try again" onClick={actions.retry} />;
    case "completing":
    case "exiting":
      return <ActionFooter label="Continue" onClick={() => undefined} loading />;
    default:
      return (
        <CheckFooter
          canCheck={item !== undefined && isDraftComplete(draft, item.exercise)}
          checking={phase.name === "checking"}
          disabled={phase.name !== "answering" || state.quitOpen}
          onCheck={actions.check}
          onSkip={actions.skip}
        />
      );
  }
}

/** Which shortcuts apply: the exercise's, CONTINUE's, or none while a modal owns the keyboard. */
function keyboardScreen({ phase, quitOpen }: LessonState): KeyboardScreen {
  if (quitOpen) return "none";
  switch (phase.name) {
    case "answering":
      return "exercise";
    case "feedback":
    case "coach":
    case "error":
      return "continue";
    default:
      return "none";
  }
}

/** Enter: CHECK, CONTINUE or TRY AGAIN, depending on the screen. */
function primaryAction(phase: Phase, actions: LessonActions): void {
  if (phase.name === "answering") actions.check();
  else if (phase.name === "feedback" || phase.name === "coach") actions.continue();
  else if (phase.name === "error") actions.retry();
}

/** The "+5s" that floats up from the clock after a correct answer in Timed practice. */
function timeBonus({ phase, session }: LessonState, item: SessionItemOut | undefined): TimeBonus | null {
  if (phase.name !== "feedback" || !phase.result.isCorrect || !session.timer || !item) return null;
  const seconds = session.timer.bonusSeconds[item.exercise.type] ?? 0;
  return seconds > 0 ? { seconds, key: phase.result.itemId } : null;
}

function toReviewItem({ prompt, given, correctAnswer, correct }: AnswerRecord): ReviewItem {
  return { prompt, given, correctAnswer, correct };
}
