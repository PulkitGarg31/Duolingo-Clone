import type { ApiError } from "@/lib/api/errors";
import type {
  AnswerIn,
  AnswerResultOut,
  CompletionOut,
  ExerciseOut,
  HeartsOut,
  SessionItemOut,
  SessionOut,
} from "@/lib/api/types";
import type { Celebration } from "@/lib/lesson/celebrations";
import { describeAnswer, type AnswerDraft } from "./answerDraft";
import { answerPayload, isDraftComplete } from "./answerPayload";

/*
 * The lesson player's state machine: a pure reducer. The server decides every grade, heart and step; this
 * only tracks which screen the player is on and patches the session with the server's answers. Requests,
 * sounds, speech and navigation happen in useLessonController, which reacts to the phases below.
 */

export const SESSION_ENDED_NOTICE = "This session has ended";

/** The owl's interstitial moments, each shown at most once per session. */
export type CoachTrigger = "combo5" | "combo10" | "wrong3" | "lastHeart";

export interface CoachMessage {
  trigger: CoachTrigger;
  /** Picks one line of the trigger's copy, the same one every time for the same lesson. */
  variant: number;
}

export type Phase =
  | { name: "answering" }
  | { name: "checking"; payload: AnswerIn }
  | { name: "feedback"; result: AnswerResultOut }
  | { name: "coach"; message: CoachMessage }
  /** Out of hearts: the refill modal is open. */
  | { name: "blocked" }
  | { name: "completing" }
  | { name: "celebrating"; completion: CompletionOut; steps: Celebration[]; index: number }
  /** A legendary run ended on its third mistake. */
  | { name: "failed" }
  /** Completing failed for a reason a retry can fix. */
  | { name: "error"; error: ApiError }
  /** The player is done: go to `href`, telling the learner why when `notice` is set. */
  | { name: "exiting"; href: string; notice: string | null };

/** One graded answer, for the scorecard behind REVIEW LESSON. It lives only in memory. */
export interface AnswerRecord {
  itemId: number;
  prompt: string;
  given: string;
  correctAnswer: string | null;
  correct: boolean;
}

export interface LessonState {
  /** Server truth: items grow with retries and are patched from each graded answer. */
  session: SessionOut;
  draft: AnswerDraft | null;
  phase: Phase;
  /** The quit modal is an overlay: it never changes the phase underneath. */
  quitOpen: boolean;
  /** Timed practice: the clock ran out while an answer was in flight. */
  timeUp: boolean;
  /** Consecutive wrong answers (the coach steps in at 3). */
  wrongStreak: number;
  coachShown: CoachTrigger[];
  /** Settings → Motivational messages. */
  coachEnabled: boolean;
  answers: AnswerRecord[];
  /** False for a session resumed with answers from an earlier visit, whose scorecard would be incomplete. */
  reviewable: boolean;
}

export type LessonEvent =
  | { type: "DRAFT_CHANGED"; draft: AnswerDraft | null }
  | { type: "CHECK" }
  | { type: "SKIP" }
  | { type: "CANT_LISTEN" }
  | { type: "ANSWER_OK"; result: AnswerResultOut }
  | { type: "ANSWER_FAILED"; error: ApiError }
  | { type: "CONTINUE" }
  | { type: "REFILLED"; hearts: HeartsOut }
  /** `steps` are the celebration screens for this receipt, in order (`buildCelebrations`). */
  | { type: "COMPLETE_OK"; completion: CompletionOut; steps: Celebration[] }
  | { type: "COMPLETE_FAILED"; error: ApiError }
  | { type: "RETRY" }
  | { type: "NEXT_CELEBRATION" }
  | { type: "TIME_UP" }
  | { type: "QUIT_OPEN" }
  | { type: "QUIT_CANCEL" }
  /** A fresh copy of the session from the server, after the two sides disagreed about the current item. */
  | { type: "SYNCED"; session: SessionOut };

export interface LessonOptions {
  /** Settings → Motivational messages: whether the owl may interrupt with coach slides. */
  motivational: boolean;
}

// Every transition creates a new phase object, so the controller can react to each phase it enters exactly
// once by comparing identities.
const answering = (): Phase => ({ name: "answering" });
const completing = (): Phase => ({ name: "completing" });
const blocked = (): Phase => ({ name: "blocked" });
const sessionEnded = (): Phase => ({ name: "exiting", href: "/learn", notice: SESSION_ENDED_NOTICE });

// ------------------------------------------------------------------------------------------------ selectors

export function currentItem(session: SessionOut): SessionItemOut | undefined {
  return session.items.find((item) => item.id === session.currentItemId);
}

/** The item on screen: the one just graded while its feedback shows, otherwise the current one. */
export function shownItem(state: LessonState): SessionItemOut | undefined {
  const { phase, session } = state;
  if (phase.name === "feedback") return session.items.find((item) => item.id === phase.result.itemId);
  return currentItem(session);
}

function isAudioOnly(exercise: ExerciseOut): boolean {
  return exercise.type === "type_answer" && exercise.audioOnly;
}

// ----------------------------------------------------------------------------------------------- start state

/**
 * The state for a session fetched from the server (a fresh start, a refresh or the back button). An active
 * session resumes where the server says; a completed one replays its completion to celebrate again; an
 * ended one sends the learner back to the path.
 */
export function initLessonState(session: SessionOut, options: LessonOptions): LessonState {
  return {
    session,
    draft: null,
    phase: startPhase(session),
    quitOpen: false,
    timeUp: false,
    wrongStreak: 0,
    coachShown: [],
    coachEnabled: options.motivational,
    answers: [],
    reviewable: session.items.every((item) => item.result === null),
  };
}

function startPhase(session: SessionOut): Phase {
  switch (session.status) {
    case "completed":
      return completing();
    case "abandoned":
    case "failed":
      return sessionEnded();
    case "active":
      return session.blockedReason ? blocked() : nextPlayPhase(session);
  }
}

// --------------------------------------------------------------------------------------------------- reducer

export function lessonReducer(state: LessonState, event: LessonEvent): LessonState {
  const { phase } = state;
  switch (event.type) {
    case "DRAFT_CHANGED":
      return isAnswering(state) ? { ...state, draft: event.draft } : state;
    case "CHECK":
      return check(state);
    case "SKIP":
      return isAnswering(state) && currentItem(state.session) ? submit(state, { type: "skip" }) : state;
    case "CANT_LISTEN": {
      const item = currentItem(state.session);
      return isAnswering(state) && item && isAudioOnly(item.exercise) ? submit(state, { type: "cant_listen" }) : state;
    }
    case "ANSWER_OK":
      return phase.name === "checking" ? answered(state, event.result) : state;
    case "ANSWER_FAILED":
      return phase.name === "checking" ? answerFailed(state, event.error) : state;
    case "CONTINUE":
      if (state.quitOpen) return state;
      if (phase.name === "feedback") return continueFromFeedback(state, phase.result);
      if (phase.name === "coach") return { ...state, phase: nextPlayPhase(state.session) };
      return state;
    case "REFILLED":
      if (phase.name !== "blocked") return state;
      return {
        ...state,
        session: { ...state.session, hearts: event.hearts, blockedReason: null },
        phase: nextPlayPhase(state.session),
      };
    case "COMPLETE_OK":
      if (phase.name !== "completing") return state;
      return {
        ...state,
        quitOpen: false,
        phase: { name: "celebrating", completion: event.completion, steps: event.steps, index: 0 },
      };
    case "COMPLETE_FAILED":
      return phase.name === "completing" ? completeFailed(state, event.error) : state;
    case "RETRY":
      return phase.name === "error" ? { ...state, phase: completing() } : state;
    case "NEXT_CELEBRATION":
      return phase.name === "celebrating" ? nextCelebration(state, phase) : state;
    case "TIME_UP":
      return timeUp(state);
    case "QUIT_OPEN":
      return canQuit(phase) ? { ...state, quitOpen: true } : state;
    case "QUIT_CANCEL":
      return { ...state, quitOpen: false };
    case "SYNCED":
      return {
        ...initLessonState(event.session, { motivational: state.coachEnabled }),
        coachShown: state.coachShown,
        answers: state.answers,
        reviewable: false,
      };
  }
}

/** The learner can act on the exercise: nothing is in flight and no overlay covers it. */
function isAnswering(state: LessonState): boolean {
  return state.phase.name === "answering" && !state.quitOpen;
}

/** CHECK is ignored unless the draft answers the current exercise, so a double submit is impossible. */
function check(state: LessonState): LessonState {
  const item = currentItem(state.session);
  if (!isAnswering(state) || !item || !isDraftComplete(state.draft, item.exercise)) return state;
  return submit(state, answerPayload(state.draft));
}

function submit(state: LessonState, payload: AnswerIn): LessonState {
  return { ...state, phase: { name: "checking", payload } };
}

function answered(state: LessonState, result: AnswerResultOut): LessonState {
  const session = applyResult(state.session, result);
  const next: LessonState = {
    ...state,
    session,
    answers: recordAnswer(state, result),
    wrongStreak: nextWrongStreak(state.wrongStreak, result),
  };
  // Timed practice: the clock ran out while this answer was in flight, so the run ends now.
  if (state.timeUp) return { ...next, draft: null, phase: completing() };
  // CAN'T LISTEN NOW skips the item silently: no feedback bar.
  if (result.result === "cant_listen") return { ...next, draft: null, phase: nextPlayPhase(session) };
  return { ...next, phase: { name: "feedback", result } };
}

/** The session after a graded answer: the server's numbers, the item's verdict and any retry it appended. */
function applyResult(session: SessionOut, result: AnswerResultOut): SessionOut {
  const { session: after } = result;
  let items = session.items.map((item) =>
    item.id === result.itemId ? { ...item, result: result.result, note: result.note } : item,
  );
  if (result.result === "cant_listen") {
    // The server resolves every unanswered listening item of the session the same way.
    items = items.map((item) =>
      item.result === null && isAudioOnly(item.exercise) ? { ...item, result: "cant_listen" as const } : item,
    );
  }
  const retry = result.appendedItem;
  if (retry && !items.some((item) => item.id === retry.id)) items = [...items, retry];
  return {
    ...session,
    items,
    status: after.status,
    endReason: after.endReason,
    blockedReason: after.blockedReason,
    canComplete: after.canComplete,
    currentItemId: after.currentItemId,
    hearts: result.hearts,
    progress: result.progress,
    mistakes: result.mistakes,
    combo: result.combo,
    bestCombo: result.bestCombo,
    lives: session.lives && after.livesLeft !== null ? { ...session.lives, left: after.livesLeft } : session.lives,
    timer: session.timer && after.expiresAt ? { ...session.timer, expiresAt: after.expiresAt } : session.timer,
  };
}

/** Wrong answers and skips extend the streak, a correct one ends it; CAN'T LISTEN NOW is neutral. */
function nextWrongStreak(streak: number, result: AnswerResultOut): number {
  if (result.result === "correct") return 0;
  if (result.result === "cant_listen") return streak;
  return streak + 1;
}

function recordAnswer(state: LessonState, result: AnswerResultOut): AnswerRecord[] {
  const item = state.session.items.find((entry) => entry.id === result.itemId);
  if (!item || result.result === "cant_listen") return state.answers;
  const skipped = state.phase.name === "checking" && state.phase.payload.type === "skip";
  const record: AnswerRecord = {
    itemId: item.id,
    prompt: reviewPrompt(item.exercise),
    given: skipped ? "Skipped" : describeAnswer(item.exercise, state.draft),
    correctAnswer: result.correctAnswer,
    correct: result.isCorrect,
  };
  return [...state.answers, record];
}

/** The sentence to translate when there is a visible one; a listening sentence stays hidden. */
function reviewPrompt(exercise: ExerciseOut): string {
  switch (exercise.type) {
    case "multiple_choice":
      return exercise.prompt?.text ?? exercise.instruction;
    case "match_pairs":
      return exercise.instruction;
    case "type_answer":
      return exercise.audioOnly ? exercise.instruction : exercise.prompt.text;
    case "translate":
    case "fill_blank":
      return exercise.prompt.text;
  }
}

function answerFailed(state: LessonState, error: ApiError): LessonState {
  if (error.code === "SESSION_NOT_ACTIVE") return { ...state, phase: sessionEnded() };
  // Timed practice: late answers complete the run, as does any failure once the clock has run out.
  if (state.timeUp || error.code === "SESSION_EXPIRED") return { ...state, draft: null, phase: completing() };
  if (error.code === "OUT_OF_HEARTS") return outOfHearts(state, error);
  // Unreachable server, server bug or an answer slot that moved on: the draft is kept and CHECK can be
  // pressed again, which is safe because a repeated PUT replays the stored grade.
  return { ...state, phase: answering() };
}

function outOfHearts(state: LessonState, error: ApiError): LessonState {
  const hearts = state.session.hearts;
  const nextHeartAt = error.problem?.nextHeartAt ?? hearts.nextHeartAt;
  return {
    ...state,
    session: { ...state.session, blockedReason: "OUT_OF_HEARTS", hearts: { ...hearts, current: 0, nextHeartAt } },
    phase: blocked(),
  };
}

function continueFromFeedback(state: LessonState, result: AnswerResultOut): LessonState {
  const { session } = state;
  const cleared = { ...state, draft: null };
  if (session.status === "failed") return { ...cleared, phase: { name: "failed" } };
  if (session.blockedReason) return { ...cleared, phase: blocked() };
  if (session.canComplete) return { ...cleared, phase: completing() };
  const trigger = coachTrigger(state, result);
  if (!trigger) return { ...cleared, phase: answering() };
  return {
    ...cleared,
    coachShown: [...state.coachShown, trigger],
    phase: { name: "coach", message: { trigger, variant: session.id + state.answers.length } },
  };
}

/**
 * The coach slide due after this answer, if any: at exactly 5 and 10 in a row, after 3 wrong answers in a row
 * and when a lesson is down to its last heart, each once per session. Lessons and practice only: in Legendary
 * a slide would break the challenge and in Timed practice it would eat the clock.
 */
function coachTrigger(state: LessonState, result: AnswerResultOut): CoachTrigger | null {
  const { kind } = state.session;
  if (!state.coachEnabled || (kind !== "lesson" && kind !== "practice")) return null;
  const due: CoachTrigger[] = [];
  if (kind === "lesson" && result.heartLost && result.hearts.current === 1) due.push("lastHeart");
  if (state.wrongStreak === 3) due.push("wrong3");
  if (result.isCorrect && result.combo === 10) due.push("combo10");
  if (result.isCorrect && result.combo === 5) due.push("combo5");
  return due.find((trigger) => !state.coachShown.includes(trigger)) ?? null;
}

/** Back to the exercises, or to the completion when nothing is left to answer. */
function nextPlayPhase(session: SessionOut): Phase {
  return session.canComplete || session.currentItemId === null ? completing() : answering();
}

function completeFailed(state: LessonState, error: ApiError): LessonState {
  if (error.code === "OUT_OF_HEARTS") return outOfHearts(state, error);
  if (error.code === "SESSION_NOT_ACTIVE" || error.code === "NOT_FOUND") return { ...state, phase: sessionEnded() };
  // Completing is idempotent on the server, so RETRY simply asks again.
  return { ...state, phase: { name: "error", error } };
}

function nextCelebration(state: LessonState, phase: Extract<Phase, { name: "celebrating" }>): LessonState {
  if (phase.index + 1 < phase.steps.length) return { ...state, phase: { ...phase, index: phase.index + 1 } };
  // Back on the path, the newly unlocked node (or the node just played) gets the focus.
  const { node } = phase.completion;
  const focus = node ? (node.unlockedNodeIds[0] ?? node.id) : null;
  return { ...state, phase: { name: "exiting", href: focus === null ? "/learn" : `/learn?focus=${focus}`, notice: null } };
}

function timeUp(state: LessonState): LessonState {
  if (state.session.kind !== "timed") return state;
  switch (state.phase.name) {
    case "answering":
    case "feedback":
      return { ...state, timeUp: true, draft: null, phase: completing() };
    case "checking":
      // Completing now would make the pending answer fail with SESSION_NOT_ACTIVE; wait for it to settle.
      return { ...state, timeUp: true };
    default:
      return state;
  }
}

/** Quitting is possible while playing; the out-of-hearts and legendary-fail modals offer their own way out. */
function canQuit(phase: Phase): boolean {
  switch (phase.name) {
    case "answering":
    case "checking":
    case "feedback":
    case "coach":
    case "completing":
    case "error":
      return true;
    case "blocked":
    case "celebrating":
    case "failed":
    case "exiting":
      return false;
  }
}
