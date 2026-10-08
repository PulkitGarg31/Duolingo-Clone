import type { AnswerDraft } from "@/lib/lesson/answerDraft";

/** Everything the learner can do in the player. The controller implements them; the screen only calls them. */
export interface LessonActions {
  draft(next: AnswerDraft | null): void;
  /** A token, card or tile was pressed. */
  tap(): void;
  check(): void;
  skip(): void;
  cantListen(): void;
  continue(): void;
  openQuit(): void;
  cancelQuit(): void;
  endSession(): void;
  /** Out of hearts: buy a refill. */
  refill(): void;
  /** Out of hearts: give up the lesson. */
  noThanks(): void;
  /** Legendary failed: start a new run. */
  tryAgain(): void;
  /** Legendary failed: back to the path. */
  leave(): void;
  /** Completing failed: ask again. */
  retry(): void;
  nextCelebration(): void;
  timeUp(): void;
  report(): void;
  /** Ctrl+Space: say the prompt again. */
  replay(slow: boolean): void;
}

/** Requests started by the learner that are still on their way. */
export interface LessonPending {
  quitting: boolean;
  refilling: boolean;
  restarting: boolean;
}

/** Speech for the lesson. */
export interface LessonAudio {
  /** A voice can speak Spanish here; without one, speaker buttons are hidden. */
  available: boolean;
  /** The current exercise's prompt is being spoken. */
  promptPlaying: boolean;
  playPrompt(slow?: boolean): void;
  speak(text: string): void;
}
