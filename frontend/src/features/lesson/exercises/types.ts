import type { ExerciseOut } from "@/lib/api/types";
import type { AnswerDraft } from "@/lib/lesson/answerDraft";

/** Speech for the exercise on screen. */
export interface ExerciseAudio {
  /** A voice can speak Spanish on this device; speaker buttons are hidden without one. */
  available: boolean;
  /** The exercise's prompt sentence is being spoken (its speaker animates, its speaker character talks). */
  playing: boolean;
  /** Speaks the prompt sentence, slowly for the turtle. */
  play(slow?: boolean): void;
  /** Speaks a Spanish word or phrase the learner tapped. */
  speak(text: string): void;
}

/** What every exercise view receives. Views hold no lesson logic: they edit the draft and report taps. */
export interface ExerciseViewProps<E extends ExerciseOut> {
  exercise: E;
  draft: AnswerDraft | null;
  onDraft(draft: AnswerDraft | null): void;
  /** Checking or showing feedback: the answer can no longer change (the verdict shows in the footer). */
  locked: boolean;
  /** False in Legendary, where the dotted hint words are switched off. */
  hintsEnabled: boolean;
  /** Match pairs submits itself when the last pair is matched. */
  onAutoSubmit?(): void;
  /** A token, card or tile was pressed (the tap sound). */
  onTap(): void;
  audio: ExerciseAudio;
}
