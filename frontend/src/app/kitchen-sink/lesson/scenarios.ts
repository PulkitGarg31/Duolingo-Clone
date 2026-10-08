import type { AnswerResultOut, SessionKind, SessionOut } from "@/lib/api/types";
import type { AnswerDraft } from "@/lib/lesson/answerDraft";
import { buildCelebrations } from "@/lib/lesson/celebrations";
import { ApiError } from "@/lib/api/errors";
import {
  initLessonState,
  lessonReducer,
  type CoachTrigger,
  type LessonEvent,
  type LessonState,
} from "@/lib/lesson/lessonMachine";
import { COMPLETION, HEARTS, ME, MEANINGS, TRANSLATE_TO_ENGLISH, item, makeSession } from "./fixtures";

/*
 * Named player states for the preview page. Each one is the real reducer run over fixture events, so the
 * previews show exactly what the player renders for those answers.
 */

export interface Scenario {
  id: string;
  title: string;
  group: "Exercises" | "Feedback" | "Header" | "Coach" | "Modals" | "System" | "Interactive";
  /** Built lazily: timed fixtures read the clock. */
  state?: () => LessonState;
  /** Gems shown to the refill and Legendary buttons. */
  gems?: number;
  /** A modal covers the screen, so it has no place in the side-by-side gallery. */
  modal?: boolean;
  /** An interactive run on the in-memory server. */
  demo?: SessionKind;
}

/** The lesson with the first `index` items answered correctly and item `index` current. */
function lessonAt(index: number, kind: SessionKind = "lesson", extra: Partial<SessionOut> = {}): SessionOut {
  const base = makeSession(kind);
  const items = base.items.map((entry, position) => (position < index ? { ...entry, result: "correct" as const } : entry));
  return {
    ...base,
    items,
    currentItemId: items[index].id,
    progress: { completed: index, total: items.length },
    combo: index,
    bestCombo: index,
    ...extra,
  };
}

function play(session: SessionOut, ...events: LessonEvent[]): LessonState {
  return events.reduce(lessonReducer, initLessonState(session, { motivational: true }));
}

/** The server's grade for the current item of `session`. */
function graded(session: SessionOut, verdict: AnswerResultOut["result"], extra: Partial<AnswerResultOut> = {}): AnswerResultOut {
  const current = session.items.find((entry) => entry.id === session.currentItemId) ?? session.items[0];
  const correct = verdict === "correct";
  const hearts = correct || session.kind !== "lesson" ? session.hearts : { ...session.hearts, current: session.hearts.current - 1 };
  const next = session.items.find((entry) => entry.seq === current.seq + 1);
  return {
    itemId: current.id,
    replayed: false,
    result: verdict,
    isCorrect: correct,
    note: null,
    correctAnswer: null,
    meaning: MEANINGS[current.exercise.id] ?? null,
    heartLost: !correct && session.kind === "lesson",
    hearts,
    progress: { ...session.progress, completed: session.progress.completed + (correct ? 1 : 0) },
    mistakes: session.mistakes + (correct ? 0 : 1),
    combo: correct ? session.combo + 1 : 0,
    bestCombo: Math.max(session.bestCombo, correct ? session.combo + 1 : 0),
    appendedItem: null,
    session: {
      status: "active",
      endReason: null,
      blockedReason: null,
      canComplete: false,
      currentItemId: next?.id ?? null,
      livesLeft: session.lives?.left ?? null,
      expiresAt: session.timer?.expiresAt ?? null,
    },
    ...extra,
  };
}

/** Answers the current item with `draft` and shows the server's verdict. */
function answered(session: SessionOut, draft: AnswerDraft, verdict: AnswerResultOut["result"], extra: Partial<AnswerResultOut> = {}) {
  return play(session, { type: "DRAFT_CHANGED", draft }, { type: "CHECK" }, { type: "ANSWER_OK", result: graded(session, verdict, extra) });
}

function drafted(session: SessionOut, draft: AnswerDraft): LessonState {
  return play(session, { type: "DRAFT_CHANGED", draft });
}

function coach(trigger: CoachTrigger, variant: number, session: SessionOut = lessonAt(5)): LessonState {
  return { ...play(session), phase: { name: "coach", message: { trigger, variant } } };
}

const tiles = (...tileIds: number[]): AnswerDraft => ({ type: "translate", mode: "tiles", tileIds });
const option = (type: "multiple_choice" | "fill_blank", optionId: number): AnswerDraft => ({ type, optionId });
const typed = (text: string): AnswerDraft => ({ type: "type_answer", text });
const matched = (ids: number[], mistakes = 0): AnswerDraft => ({
  type: "match_pairs",
  matched: ids.map((id) => ({ leftId: id, rightId: id })),
  mistakes,
});

/** The translate exercise again, retried at the end of the lesson. */
function withRetry(): SessionOut {
  const session = lessonAt(8 - 1);
  const retry = item(109, 9, TRANSLATE_TO_ENGLISH, { origin: "retry", label: "previous_mistake" });
  const items = session.items.map((entry) => ({ ...entry, result: "correct" as const }));
  return { ...session, items: [...items, retry], currentItemId: retry.id, progress: { completed: 7, total: 8 } };
}

export const SCENARIOS: Scenario[] = [
  // Exercises, being answered
  { id: "pictures", title: "Picture choice", group: "Exercises", state: () => drafted(lessonAt(0), option("multiple_choice", 302)) },
  { id: "translate", title: "Word bank", group: "Exercises", state: () => drafted(lessonAt(1), tiles(313, 315)) },
  { id: "match", title: "Match pairs, two matched", group: "Exercises", state: () => drafted(lessonAt(2), matched([41, 43], 1)) },
  { id: "fill", title: "Fill in the blank", group: "Exercises", state: () => drafted(lessonAt(3), option("fill_blank", 322)) },
  { id: "list", title: "Text choice", group: "Exercises", state: () => drafted(lessonAt(4), option("multiple_choice", 342)) },
  { id: "translate-spanish", title: "Word bank into Spanish", group: "Exercises", state: () => drafted(lessonAt(5), tiles(333, 335)) },
  {
    id: "translate-keyboard",
    title: "Word bank, keyboard mode",
    group: "Exercises",
    state: () => drafted(lessonAt(5), { type: "translate", mode: "keyboard", text: "Quiero un jugo" }),
  },
  { id: "type", title: "Type the answer", group: "Exercises", state: () => drafted(lessonAt(6), typed("Buenas noshes")) },
  { id: "listen", title: "Type what you hear", group: "Exercises", state: () => play(lessonAt(7)) },
  { id: "retry", title: "Previous mistake", group: "Exercises", state: () => play(withRetry()) },
  { id: "checking", title: "Checking", group: "Exercises", state: () => play(lessonAt(0), { type: "DRAFT_CHANGED", draft: option("multiple_choice", 302) }, { type: "CHECK" }) },

  // Feedback bar
  { id: "pictures-correct", title: "Correct", group: "Feedback", state: () => answered(lessonAt(0), option("multiple_choice", 302), "correct") },
  {
    id: "pictures-incorrect",
    title: "Incorrect (a heart is lost)",
    group: "Feedback",
    state: () => answered(lessonAt(0), option("multiple_choice", 301), "incorrect", { correctAnswer: "el jugo" }),
  },
  {
    id: "translate-incorrect",
    title: "Wrong word, marked",
    group: "Feedback",
    state: () => answered(lessonAt(1), tiles(313, 314, 311), "incorrect", { correctAnswer: "I drink water.", note: "wrong_word" }),
  },
  { id: "translate-correct", title: "Correct, 2 in a row", group: "Feedback", state: () => answered(lessonAt(1), tiles(313, 315, 311), "correct") },
  { id: "match-correct", title: "All pairs matched", group: "Feedback", state: () => answered(lessonAt(2), matched([41, 42, 43, 44], 1), "correct") },
  {
    id: "fill-incorrect",
    title: "Fill in the blank, wrong",
    group: "Feedback",
    state: () => answered(lessonAt(3), option("fill_blank", 321), "incorrect", { correctAnswer: "Tú bebes agua." }),
  },
  { id: "fill-correct", title: "Fill in the blank, right", group: "Feedback", state: () => answered(lessonAt(3), option("fill_blank", 322), "correct") },
  {
    id: "list-incorrect",
    title: "Text choice, wrong",
    group: "Feedback",
    state: () => answered(lessonAt(4), option("multiple_choice", 341), "incorrect", { correctAnswer: "A coffee with milk, please." }),
  },
  {
    id: "type-incorrect",
    title: "Typed answer, a real but wrong word",
    group: "Feedback",
    state: () => answered(lessonAt(6), typed("Buenos noches"), "incorrect", { note: "wrong_word", correctAnswer: "Buenas noches" }),
  },
  {
    id: "type-typo",
    title: "Correct with a typo",
    group: "Feedback",
    state: () => answered(lessonAt(6), typed("Buenas noshes"), "correct", { note: "typo", correctAnswer: "Buenas noches" }),
  },
  {
    id: "alternate",
    title: "Another correct solution",
    group: "Feedback",
    state: () => answered(lessonAt(1), tiles(313, 315, 311), "correct", { note: "alternate", correctAnswer: "I am drinking water." }),
  },
  {
    id: "listen-incorrect",
    title: "Listening, with the meaning",
    group: "Feedback",
    state: () => answered(lessonAt(7), typed("Quiero"), "incorrect", { note: "missing_word", correctAnswer: "Quiero agua." }),
  },
  {
    id: "skipped",
    title: "Skipped",
    group: "Feedback",
    state: () => play(lessonAt(3), { type: "SKIP" }, { type: "ANSWER_OK", result: graded(lessonAt(3), "skipped", { correctAnswer: "Tú bebes agua." }) }),
  },

  // Header variants
  { id: "last-heart", title: "Last heart (pulsing)", group: "Header", state: () => play(lessonAt(4, "lesson", { hearts: { ...HEARTS, current: 1 } })) },
  { id: "combo-hot", title: "6 in a row (gold bar)", group: "Header", state: () => answered(lessonAt(5), tiles(333, 335, 331, 336, 332), "correct") },
  { id: "combo-fire", title: "11 in a row (orange bar)", group: "Header", state: () => play(lessonAt(6, "lesson", { combo: 11, bestCombo: 11 })) },
  { id: "legendary", title: "Legendary: lives and the 40 XP checkpoint", group: "Header", state: () => play(lessonAt(3, "legendary", { mistakes: 1, combo: 0, lives: { max: 3, left: 2 } })) },
  { id: "timed", title: "Timed practice: clock and milestones", group: "Header", state: () => play(lessonAt(6, "timed")) },
  { id: "practice", title: "Practice: no hearts", group: "Header", state: () => play(lessonAt(4, "practice")) },

  // Coach slides
  { id: "coach-combo5", title: "5 in a row", group: "Coach", state: () => coach("combo5", 2) },
  { id: "coach-wrong3", title: "3 wrong in a row", group: "Coach", state: () => coach("wrong3", 0) },
  { id: "coach-last-heart", title: "Last heart", group: "Coach", state: () => coach("lastHeart", 0, lessonAt(5, "lesson", { hearts: { ...HEARTS, current: 1 } })) },

  // Modals
  { id: "quit", title: "Quit confirmation", group: "Modals", modal: true, state: () => play(lessonAt(2), { type: "QUIT_OPEN" }) },
  { id: "out-of-hearts", title: "Out of hearts", group: "Modals", modal: true, gems: ME.gems, state: () => play(lessonAt(4, "lesson", { blockedReason: "OUT_OF_HEARTS", hearts: { ...HEARTS, current: 0 } })) },
  { id: "out-of-hearts-short", title: "Out of hearts, not enough gems", group: "Modals", modal: true, gems: 120, state: () => play(lessonAt(4, "lesson", { blockedReason: "OUT_OF_HEARTS", hearts: { ...HEARTS, current: 0 } })) },
  { id: "legendary-failed", title: "Legendary failed", group: "Modals", modal: true, gems: ME.gems, state: () => ({ ...play(lessonAt(3, "legendary", { lives: { max: 3, left: 0 } })), phase: { name: "failed" } }) },

  // System states
  { id: "completing", title: "Saving the lesson", group: "System", state: () => play(lessonAt(7, "lesson", { canComplete: true, currentItemId: null })) },
  {
    id: "error",
    title: "Completing failed",
    group: "System",
    state: () => ({
      ...play(lessonAt(7, "lesson", { canComplete: true, currentItemId: null })),
      phase: { name: "error", error: new ApiError({ status: 503, code: "HTTP_ERROR", title: "Unavailable", detail: "", requestId: "req_7f3a2c" }) },
    }),
  },
  {
    id: "celebrating",
    title: "Celebrations",
    group: "System",
    state: () => play(lessonAt(7, "lesson", { canComplete: true, currentItemId: null }), { type: "COMPLETE_OK", completion: COMPLETION, steps: buildCelebrations(COMPLETION) }),
  },

  // Interactive runs on the in-memory server
  { id: "demo-lesson", title: "Play a lesson", group: "Interactive", demo: "lesson" },
  { id: "demo-practice", title: "Play a practice", group: "Interactive", demo: "practice" },
  { id: "demo-legendary", title: "Play Legendary", group: "Interactive", demo: "legendary" },
  { id: "demo-timed", title: "Play Timed practice", group: "Interactive", demo: "timed" },
];
