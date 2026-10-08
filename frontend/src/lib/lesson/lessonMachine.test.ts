import { describe, expect, it } from "vitest";
import { ApiError, type ApiErrorCode } from "@/lib/api/errors";
import type {
  AnswerResultOut,
  CompletionOut,
  ExerciseOut,
  HeartsOut,
  SessionItemOut,
  SessionKind,
  SessionOut,
  SessionStateOut,
} from "@/lib/api/types";
import type { Celebration } from "@/lib/lesson/celebrations";
import type { AnswerDraft } from "./answerDraft";
import {
  SESSION_ENDED_NOTICE,
  initLessonState,
  lessonReducer,
  shownItem,
  type LessonEvent,
  type LessonState,
} from "./lessonMachine";

// ------------------------------------------------------------------------------------------------ fixtures

const pictures: ExerciseOut = {
  id: 69,
  type: "multiple_choice",
  instruction: "Which one of these is “the juice”?",
  prompt: null,
  layout: "pictures",
  options: [
    { id: 301, text: "el agua", imageKey: "water" },
    { id: 302, text: "el jugo", imageKey: "juice" },
  ],
};

const translate: ExerciseOut = {
  id: 70,
  type: "translate",
  instruction: "Write this in English",
  prompt: { text: "Yo bebo agua.", language: "es", speak: true, segments: [] },
  answerLanguage: "en",
  tiles: [
    { id: 311, text: "water" },
    { id: 313, text: "I" },
    { id: 315, text: "drink" },
  ],
  specialCharacters: [],
};

function listen(id: number, text: string): ExerciseOut {
  return {
    id,
    type: "type_answer",
    instruction: "Type what you hear",
    prompt: { text, language: "es", speak: true, segments: [] },
    audioOnly: true,
    answerLanguage: "es",
    specialCharacters: [],
  };
}

function item(id: number, seq: number, exercise: ExerciseOut, extra: Partial<SessionItemOut> = {}): SessionItemOut {
  return { id, seq, origin: "initial", label: null, result: null, note: null, exercise, ...extra };
}

const HEARTS: HeartsOut = {
  current: 4,
  max: 5,
  nextHeartAt: "2026-10-08T16:00:00Z",
  fullAt: "2026-10-08T16:00:00Z",
  regenIntervalSeconds: 18000,
  refillPriceGems: 350,
};

/** Lesson 2 of "Drinks": a picture choice, a translation and two listening items. */
function lessonSession(extra: Partial<SessionOut> = {}): SessionOut {
  return {
    id: 14,
    kind: "lesson",
    status: "active",
    endReason: null,
    resumed: false,
    node: { id: 6, kind: "skill", title: "Drinks", unitId: 2, unitNumber: 2, unitColor: "purple" },
    lesson: { id: 12, number: 2, count: 3 },
    rules: { heartsEnabled: true, retryPolicy: "always", hintsEnabled: true, maxMistakes: null },
    timer: null,
    startedAt: "2026-10-08T12:00:05Z",
    serverNow: "2026-10-08T12:00:05Z",
    hearts: HEARTS,
    lives: null,
    progress: { completed: 0, total: 4 },
    mistakes: 0,
    combo: 0,
    bestCombo: 0,
    currentItemId: 101,
    blockedReason: null,
    canComplete: false,
    items: [
      item(101, 1, pictures, { label: "new_word" }),
      item(102, 2, translate),
      item(103, 3, listen(74, "Quiero agua.")),
      item(104, 4, listen(75, "Bebo leche.")),
    ],
    ...extra,
  };
}

function sessionOfKind(kind: SessionKind, extra: Partial<SessionOut> = {}): SessionOut {
  const rules: Record<SessionKind, SessionOut["rules"]> = {
    lesson: { heartsEnabled: true, retryPolicy: "always", hintsEnabled: true, maxMistakes: null },
    practice: { heartsEnabled: false, retryPolicy: "once", hintsEnabled: true, maxMistakes: null },
    legendary: { heartsEnabled: false, retryPolicy: "never", hintsEnabled: false, maxMistakes: 2 },
    timed: { heartsEnabled: false, retryPolicy: "never", hintsEnabled: true, maxMistakes: null },
  };
  return lessonSession({
    kind,
    rules: rules[kind],
    lives: kind === "legendary" ? { max: 3, left: 3 } : null,
    timer:
      kind === "timed"
        ? {
            startSeconds: 30,
            bonusSeconds: { multiple_choice: 5, match_pairs: 5, fill_blank: 10, translate: 10 },
            expiresAt: "2026-10-08T12:00:35Z",
          }
        : null,
    ...extra,
  });
}

interface ResultOptions extends Partial<Omit<AnswerResultOut, "session">> {
  state?: Partial<SessionStateOut>;
}

/** The server's grade for `itemId`; the next item becomes current unless `state` says otherwise. */
function graded(itemId: number, verdict: AnswerResultOut["result"], options: ResultOptions = {}): AnswerResultOut {
  const { state, ...rest } = options;
  return {
    itemId,
    replayed: false,
    result: verdict,
    isCorrect: verdict === "correct",
    note: null,
    correctAnswer: verdict === "correct" ? null : "I drink water.",
    meaning: null,
    heartLost: false,
    hearts: HEARTS,
    progress: { completed: verdict === "correct" ? 1 : 0, total: 4 },
    mistakes: verdict === "correct" ? 0 : 1,
    combo: verdict === "correct" ? 1 : 0,
    bestCombo: 1,
    appendedItem: null,
    session: {
      status: "active",
      endReason: null,
      blockedReason: null,
      canComplete: false,
      currentItemId: itemId + 1,
      livesLeft: null,
      expiresAt: null,
      ...state,
    },
    ...rest,
  };
}

function apiError(code: ApiErrorCode, status = 409, problem: Partial<ApiError["problem"]> = {}): ApiError {
  return new ApiError({
    status,
    code,
    title: code,
    detail: code,
    problem: {
      type: "about:blank",
      title: code,
      status,
      detail: code,
      instance: "/api/v1/sessions/14",
      code: code as never,
      requestId: "req-1",
      errors: [],
      ...problem,
    },
  });
}

const networkError = () => ApiError.network(new TypeError("Failed to fetch"));

/** The reducer reads only `node` from a receipt; the rest is passed through to the celebration screens. */
function receipt(node: CompletionOut["node"]): CompletionOut {
  return { sessionId: 14, kind: "lesson", replayed: false, node } as CompletionOut;
}

/** Celebration steps are opaque to the reducer: it only walks through them in order. */
const STEPS = ["summary", "streak", "achievement"] as unknown as Celebration[];

const TILES: AnswerDraft = { type: "translate", mode: "tiles", tileIds: [313, 315, 311] };

function run(state: LessonState, ...events: LessonEvent[]): LessonState {
  return events.reduce(lessonReducer, state);
}

function start(session: SessionOut = lessonSession(), motivational = true): LessonState {
  return initLessonState(session, { motivational });
}

/** A lesson waiting on the answer to the current item. */
function checking(session: SessionOut = lessonSession(), draft: AnswerDraft = { type: "multiple_choice", optionId: 302 }) {
  return run(start(session), { type: "DRAFT_CHANGED", draft }, { type: "CHECK" });
}

/** A complete answer for any exercise of the fixtures. */
function draftFor(exercise: ExerciseOut): AnswerDraft {
  switch (exercise.type) {
    case "multiple_choice":
      return { type: "multiple_choice", optionId: 302 };
    case "translate":
      return TILES;
    case "type_answer":
      return { type: "type_answer", text: "Quiero agua" };
    case "fill_blank":
      return { type: "fill_blank", optionId: exercise.options[0].id };
    case "match_pairs":
      return { type: "match_pairs", matched: exercise.left.map(({ id }) => ({ leftId: id, rightId: id })), mistakes: 0 };
  }
}

/** The feedback bar for `result`: the current item is answered and graded. `state` defaults to a fresh start. */
function feedback(session: SessionOut, result: AnswerResultOut, state?: LessonState): LessonState {
  const base = state ?? start(session);
  const current = shownItem(base);
  if (!current) throw new Error("no current item to answer");
  const draft = draftFor(current.exercise);
  return run(base, { type: "DRAFT_CHANGED", draft }, { type: "CHECK" }, { type: "ANSWER_OK", result });
}

// --------------------------------------------------------------------------------------------------- tests

describe("loading a lesson route", () => {
  it("resumes an active session at its current item", () => {
    const state = start(lessonSession({ currentItemId: 102 }));
    expect(state.phase).toEqual({ name: "answering" });
    expect(state.draft).toBeNull();
    expect(shownItem(state)?.id).toBe(102);
  });

  it("opens the out-of-hearts state for a blocked lesson", () => {
    expect(start(lessonSession({ blockedReason: "OUT_OF_HEARTS" })).phase).toEqual({ name: "blocked" });
  });

  it("completes a session that has nothing left to answer", () => {
    expect(start(lessonSession({ canComplete: true, currentItemId: null })).phase).toEqual({ name: "completing" });
  });

  it("replays the completion of a completed session to show the celebration again", () => {
    expect(start(lessonSession({ status: "completed", endReason: "passed" })).phase).toEqual({ name: "completing" });
  });

  it.each(["abandoned", "failed"] as const)("leaves a %s session for the path with a notice", (status) => {
    expect(start(lessonSession({ status })).phase).toEqual({
      name: "exiting",
      href: "/learn",
      notice: SESSION_ENDED_NOTICE,
    });
  });

  it("offers the review only when every answer was given in this visit", () => {
    expect(start().reviewable).toBe(true);
    const resumed = lessonSession({ currentItemId: 102 });
    resumed.items[0] = { ...resumed.items[0], result: "correct" };
    expect(start(resumed).reviewable).toBe(false);
  });
});

describe("answering", () => {
  it("keeps the draft as the learner changes it", () => {
    const state = run(start(), { type: "DRAFT_CHANGED", draft: { type: "multiple_choice", optionId: 301 } });
    expect(state.phase).toEqual({ name: "answering" });
    expect(state.draft).toEqual({ type: "multiple_choice", optionId: 301 });
  });

  it("CHECK sends the draft as the answer payload", () => {
    const state = checking(lessonSession({ currentItemId: 102 }), TILES);
    expect(state.phase).toEqual({ name: "checking", payload: { type: "translate", tileIds: [313, 315, 311] } });
  });

  it("ignores CHECK until the draft answers the exercise", () => {
    const empty = start();
    expect(run(empty, { type: "CHECK" })).toBe(empty);
    const noTiles = run(start(lessonSession({ currentItemId: 102 })), {
      type: "DRAFT_CHANGED",
      draft: { type: "translate", mode: "tiles", tileIds: [] },
    });
    expect(run(noTiles, { type: "CHECK" })).toBe(noTiles);
  });

  it("SKIP sends a skip", () => {
    expect(run(start(), { type: "SKIP" }).phase).toEqual({ name: "checking", payload: { type: "skip" } });
  });

  it("CANT_LISTEN sends cant_listen on a listening item only", () => {
    const listening = start(lessonSession({ currentItemId: 103 }));
    expect(run(listening, { type: "CANT_LISTEN" }).phase).toEqual({
      name: "checking",
      payload: { type: "cant_listen" },
    });
    const choice = start();
    expect(run(choice, { type: "CANT_LISTEN" })).toBe(choice);
  });

  it("ignores answers while the quit modal is open", () => {
    const open = run(start(), { type: "DRAFT_CHANGED", draft: { type: "multiple_choice", optionId: 302 } }, {
      type: "QUIT_OPEN",
    });
    expect(run(open, { type: "CHECK" })).toBe(open);
    expect(run(open, { type: "SKIP" })).toBe(open);
    expect(run(open, { type: "DRAFT_CHANGED", draft: null })).toBe(open);
  });
});

describe("checking", () => {
  it("ignores a second CHECK, so an answer can never be sent twice", () => {
    const state = checking();
    expect(run(state, { type: "CHECK" })).toBe(state);
    expect(run(state, { type: "SKIP" })).toBe(state);
  });

  it("shows the feedback and patches the session from a correct answer", () => {
    const result = graded(101, "correct", {
      progress: { completed: 1, total: 4 },
      combo: 1,
      state: { currentItemId: 102 },
    });
    const state = run(checking(), { type: "ANSWER_OK", result });
    expect(state.phase).toEqual({ name: "feedback", result });
    expect(state.session.items[0]).toMatchObject({ id: 101, result: "correct", note: null });
    expect(state.session.progress).toEqual({ completed: 1, total: 4 });
    expect(state.session.combo).toBe(1);
    expect(state.session.currentItemId).toBe(102);
    expect(state.wrongStreak).toBe(0);
    // The answered exercise stays on screen under the feedback bar.
    expect(shownItem(state)?.id).toBe(101);
  });

  it("appends the retry of a wrong answer, costs the heart and keeps the progress", () => {
    const retry = item(105, 5, translate, { origin: "retry", label: "previous_mistake" });
    const hearts = { ...HEARTS, current: 3 };
    const result = graded(102, "incorrect", {
      heartLost: true,
      hearts,
      progress: { completed: 1, total: 4 },
      appendedItem: retry,
      state: { currentItemId: 103 },
    });
    const before = run(start(lessonSession({ currentItemId: 102, progress: { completed: 1, total: 4 } })), {
      type: "DRAFT_CHANGED",
      draft: TILES,
    }, { type: "CHECK" });
    const state = run(before, { type: "ANSWER_OK", result });
    expect(state.session.items.map((entry) => entry.id)).toEqual([101, 102, 103, 104, 105]);
    expect(state.session.items[1].result).toBe("incorrect");
    expect(state.session.hearts.current).toBe(3);
    expect(state.session.progress).toEqual({ completed: 1, total: 4 });
    expect(state.wrongStreak).toBe(1);
  });

  it("does not append the same retry twice when an answer is replayed", () => {
    const retry = item(105, 5, translate, { origin: "retry" });
    const result = graded(101, "incorrect", { appendedItem: retry });
    const first = run(checking(), { type: "ANSWER_OK", result });
    const replay = lessonReducer({ ...first, phase: { name: "checking", payload: { type: "skip" } } }, {
      type: "ANSWER_OK",
      result: { ...result, replayed: true },
    });
    expect(replay.session.items.filter((entry) => entry.id === 105)).toHaveLength(1);
  });

  it("moves on without a feedback bar after CAN'T LISTEN NOW and resolves every listening item", () => {
    const listening = run(start(lessonSession({ currentItemId: 103 })), { type: "CANT_LISTEN" });
    const result = graded(103, "cant_listen", {
      correctAnswer: "Quiero agua.",
      progress: { completed: 3, total: 4 },
      state: { currentItemId: 102 },
    });
    const state = run(listening, { type: "ANSWER_OK", result });
    expect(state.phase).toEqual({ name: "answering" });
    expect(state.draft).toBeNull();
    expect(state.session.items.map((entry) => entry.result)).toEqual([null, null, "cant_listen", "cant_listen"]);
    expect(shownItem(state)?.id).toBe(102);
  });

  it("completes when CAN'T LISTEN NOW resolves the last items", () => {
    const listening = run(start(lessonSession({ currentItemId: 103 })), { type: "CANT_LISTEN" });
    const result = graded(103, "cant_listen", { state: { currentItemId: null, canComplete: true } });
    expect(run(listening, { type: "ANSWER_OK", result }).phase).toEqual({ name: "completing" });
  });

  it("blocks on OUT_OF_HEARTS with the hearts at zero", () => {
    const state = run(checking(), {
      type: "ANSWER_FAILED",
      error: apiError("OUT_OF_HEARTS", 409, { nextHeartAt: "2026-10-08T17:00:00Z" }),
    });
    expect(state.phase).toEqual({ name: "blocked" });
    expect(state.session.blockedReason).toBe("OUT_OF_HEARTS");
    expect(state.session.hearts).toMatchObject({ current: 0, nextHeartAt: "2026-10-08T17:00:00Z" });
  });

  it("completes a timed run whose answer arrived after the deadline", () => {
    const state = run(checking(sessionOfKind("timed")), { type: "ANSWER_FAILED", error: apiError("SESSION_EXPIRED") });
    expect(state.phase).toEqual({ name: "completing" });
  });

  it("leaves for the path when the session already ended elsewhere", () => {
    const state = run(checking(), { type: "ANSWER_FAILED", error: apiError("SESSION_NOT_ACTIVE") });
    expect(state.phase).toEqual({ name: "exiting", href: "/learn", notice: SESSION_ENDED_NOTICE });
  });

  it.each([
    ["an unreachable server", networkError()],
    ["a server error", apiError("INTERNAL_ERROR", 500)],
    ["an answer slot that moved on", apiError("ITEM_OUT_OF_ORDER")],
  ])("returns to answering with the draft kept after %s", (_label, error) => {
    const state = run(checking(), { type: "ANSWER_FAILED", error });
    expect(state.phase).toEqual({ name: "answering" });
    expect(state.draft).toEqual({ type: "multiple_choice", optionId: 302 });
  });
});

describe("feedback, then CONTINUE", () => {
  it("fails a legendary run on its third mistake", () => {
    const session = sessionOfKind("legendary", { mistakes: 2, lives: { max: 3, left: 1 } });
    const result = graded(101, "incorrect", {
      mistakes: 3,
      state: { status: "failed", endReason: "too_many_mistakes", currentItemId: null, livesLeft: 0 },
    });
    const state = feedback(session, result);
    expect(state.session.lives).toEqual({ max: 3, left: 0 });
    expect(run(state, { type: "CONTINUE" }).phase).toEqual({ name: "failed" });
  });

  it("opens the out-of-hearts state after the heart that emptied them", () => {
    const result = graded(101, "incorrect", {
      heartLost: true,
      hearts: { ...HEARTS, current: 0 },
      state: { blockedReason: "OUT_OF_HEARTS" },
    });
    expect(run(feedback(lessonSession(), result), { type: "CONTINUE" }).phase).toEqual({ name: "blocked" });
  });

  it("completes once nothing is left to answer", () => {
    const result = graded(101, "correct", { state: { currentItemId: null, canComplete: true } });
    expect(run(feedback(lessonSession(), result), { type: "CONTINUE" }).phase).toEqual({ name: "completing" });
  });

  it("shows the next item with an empty draft", () => {
    const state = run(feedback(lessonSession(), graded(101, "correct")), { type: "CONTINUE" });
    expect(state.phase).toEqual({ name: "answering" });
    expect(state.draft).toBeNull();
    expect(shownItem(state)?.id).toBe(102);
  });

  it("ignores CHECK and SKIP while the feedback is shown", () => {
    const state = feedback(lessonSession(), graded(101, "correct"));
    expect(run(state, { type: "CHECK" })).toBe(state);
    expect(run(state, { type: "SKIP" })).toBe(state);
  });
});

describe("coach slides", () => {
  const fifthInARow = graded(101, "correct", { combo: 5 });

  it("cheers at 5 in a row, once per session", () => {
    const first = run(feedback(lessonSession(), fifthInARow), { type: "CONTINUE" });
    expect(first.phase).toMatchObject({ name: "coach", message: { trigger: "combo5" } });
    const again = graded(102, "correct", { combo: 5 });
    const later = run(feedback(lessonSession(), again, run(first, { type: "CONTINUE" })), { type: "CONTINUE" });
    expect(later.phase).toEqual({ name: "answering" });
  });

  it("cheers at 10 in a row", () => {
    const state = run(feedback(lessonSession(), graded(101, "correct", { combo: 10 })), { type: "CONTINUE" });
    expect(state.phase).toMatchObject({ name: "coach", message: { trigger: "combo10" } });
  });

  it("encourages after 3 wrong answers in a row", () => {
    let state = start();
    for (const itemId of [101, 102, 103]) {
      state = run(feedback(lessonSession(), graded(itemId, "incorrect", { state: { currentItemId: itemId + 1 } }), state));
      if (itemId < 103) state = run(state, { type: "CONTINUE" });
    }
    expect(state.wrongStreak).toBe(3);
    expect(run(state, { type: "CONTINUE" }).phase).toMatchObject({ name: "coach", message: { trigger: "wrong3" } });
  });

  it("warns when a lesson is down to its last heart", () => {
    const result = graded(101, "incorrect", { heartLost: true, hearts: { ...HEARTS, current: 1 } });
    expect(run(feedback(lessonSession(), result), { type: "CONTINUE" }).phase).toMatchObject({
      name: "coach",
      message: { trigger: "lastHeart" },
    });
  });

  it("cheers in practice too", () => {
    const state = run(feedback(sessionOfKind("practice"), fifthInARow), { type: "CONTINUE" });
    expect(state.phase).toMatchObject({ name: "coach", message: { trigger: "combo5" } });
  });

  it.each(["legendary", "timed"] as const)("never interrupts a %s run", (kind) => {
    const state = run(feedback(sessionOfKind(kind), fifthInARow), { type: "CONTINUE" });
    expect(state.phase).toEqual({ name: "answering" });
  });

  it("stays quiet when motivational messages are off", () => {
    const state = run(feedback(lessonSession(), fifthInARow, start(lessonSession(), false)), { type: "CONTINUE" });
    expect(state.phase).toEqual({ name: "answering" });
  });

  it("continues to the next item, or completes when nothing is left", () => {
    const coach = run(feedback(lessonSession(), fifthInARow), { type: "CONTINUE" });
    expect(run(coach, { type: "CONTINUE" }).phase).toEqual({ name: "answering" });
    const done = { ...coach, session: { ...coach.session, canComplete: true, currentItemId: null } };
    expect(run(done, { type: "CONTINUE" }).phase).toEqual({ name: "completing" });
  });
});

describe("out of hearts", () => {
  it("resumes after a refill", () => {
    const blocked = start(lessonSession({ blockedReason: "OUT_OF_HEARTS", hearts: { ...HEARTS, current: 0 } }));
    const full = { ...HEARTS, current: 5, nextHeartAt: null, fullAt: null };
    const state = run(blocked, { type: "REFILLED", hearts: full });
    expect(state.phase).toEqual({ name: "answering" });
    expect(state.session.hearts).toEqual(full);
    expect(state.session.blockedReason).toBeNull();
  });

  it("ignores a refill outside the out-of-hearts state", () => {
    const state = start();
    expect(run(state, { type: "REFILLED", hearts: HEARTS })).toBe(state);
  });
});

describe("timed practice", () => {
  it("completes when the clock runs out while answering", () => {
    expect(run(start(sessionOfKind("timed")), { type: "TIME_UP" }).phase).toEqual({ name: "completing" });
  });

  it("completes when the clock runs out on the feedback bar", () => {
    const state = feedback(sessionOfKind("timed"), graded(101, "correct"));
    expect(run(state, { type: "TIME_UP" }).phase).toEqual({ name: "completing" });
  });

  it("lets an answer in flight settle before completing", () => {
    const waiting = run(checking(sessionOfKind("timed")), { type: "TIME_UP" });
    expect(waiting.phase.name).toBe("checking");
    expect(waiting.timeUp).toBe(true);
    const answered = run(waiting, { type: "ANSWER_OK", result: graded(101, "correct", { combo: 1 }) });
    expect(answered.phase).toEqual({ name: "completing" });
    expect(answered.session.items[0].result).toBe("correct");
    expect(run(waiting, { type: "ANSWER_FAILED", error: networkError() }).phase).toEqual({ name: "completing" });
  });

  it("ignores TIME_UP outside timed practice", () => {
    const state = start();
    expect(run(state, { type: "TIME_UP" })).toBe(state);
  });

  it("moves the deadline with each correct answer", () => {
    const result = graded(101, "correct", { state: { expiresAt: "2026-10-08T12:00:40Z" } });
    expect(feedback(sessionOfKind("timed"), result).session.timer?.expiresAt).toBe("2026-10-08T12:00:40Z");
  });
});

describe("completing", () => {
  const completing = () => start(lessonSession({ canComplete: true, currentItemId: null }));
  const completion = receipt({
    id: 6,
    kind: "skill",
    title: "Drinks",
    lessonsCompleted: 3,
    lessonCount: 3,
    completedNow: true,
    legendaryNow: false,
    unlockedNodeIds: [7, 8],
  });

  it("starts the celebration at its first step", () => {
    const state = run(completing(), { type: "QUIT_OPEN" }, { type: "COMPLETE_OK", completion, steps: STEPS });
    expect(state.phase).toEqual({ name: "celebrating", completion, steps: STEPS, index: 0 });
    expect(state.quitOpen).toBe(false);
  });

  it("offers a retry when the server cannot be reached, then completes again", () => {
    const failed = run(completing(), { type: "COMPLETE_FAILED", error: networkError() });
    expect(failed.phase).toMatchObject({ name: "error" });
    expect(run(failed, { type: "RETRY" }).phase).toEqual({ name: "completing" });
  });

  it("blocks when the hearts ran out", () => {
    expect(run(completing(), { type: "COMPLETE_FAILED", error: apiError("OUT_OF_HEARTS") }).phase).toEqual({
      name: "blocked",
    });
  });

  it("leaves when the session is gone", () => {
    expect(run(completing(), { type: "COMPLETE_FAILED", error: apiError("SESSION_NOT_ACTIVE") }).phase).toEqual({
      name: "exiting",
      href: "/learn",
      notice: SESSION_ENDED_NOTICE,
    });
  });
});

describe("celebrating", () => {
  function celebrating(node: CompletionOut["node"]): LessonState {
    const completing = start(lessonSession({ canComplete: true, currentItemId: null }));
    return run(completing, { type: "COMPLETE_OK", completion: receipt(node), steps: STEPS });
  }
  const node = {
    id: 6,
    kind: "skill" as const,
    title: "Drinks",
    lessonsCompleted: 3,
    lessonCount: 3,
    completedNow: true,
    legendaryNow: false,
    unlockedNodeIds: [7, 8],
  };

  it("walks through the steps in order", () => {
    expect(run(celebrating(node), { type: "NEXT_CELEBRATION" }).phase).toMatchObject({ index: 1 });
  });

  it("returns to the path focused on the first unlocked node after the last step", () => {
    const state = run(celebrating(node), ...Array<LessonEvent>(3).fill({ type: "NEXT_CELEBRATION" }));
    expect(state.phase).toEqual({ name: "exiting", href: "/learn?focus=7", notice: null });
  });

  it("focuses the node itself when nothing unlocked, and the path when there is no node", () => {
    const last = (state: LessonState) => run(state, ...Array<LessonEvent>(3).fill({ type: "NEXT_CELEBRATION" }));
    expect(last(celebrating({ ...node, unlockedNodeIds: [] })).phase).toMatchObject({ href: "/learn?focus=6" });
    expect(last(celebrating(null)).phase).toMatchObject({ href: "/learn" });
  });

  it("cannot be quit", () => {
    const state = celebrating(node);
    expect(run(state, { type: "QUIT_OPEN" })).toBe(state);
  });
});

describe("the quit modal", () => {
  it("opens and closes over any playing phase without changing it", () => {
    const answering = start();
    const open = run(answering, { type: "QUIT_OPEN" });
    expect(open.quitOpen).toBe(true);
    expect(open.phase).toBe(answering.phase);
    expect(run(open, { type: "QUIT_CANCEL" }).quitOpen).toBe(false);

    const onFeedback = run(feedback(lessonSession(), graded(101, "correct")), { type: "QUIT_OPEN" });
    expect(onFeedback.quitOpen).toBe(true);
    expect(onFeedback.phase.name).toBe("feedback");
  });

  it("lets an answer in flight land behind the open modal", () => {
    const state = run(checking(), { type: "QUIT_OPEN" }, { type: "ANSWER_OK", result: graded(101, "correct") });
    expect(state.quitOpen).toBe(true);
    expect(state.phase.name).toBe("feedback");
  });

  it("does not open over the out-of-hearts modal", () => {
    const blocked = start(lessonSession({ blockedReason: "OUT_OF_HEARTS" }));
    expect(run(blocked, { type: "QUIT_OPEN" })).toBe(blocked);
  });
});

describe("resynchronising with the server", () => {
  it("restarts at the server's current item and keeps the coach history", () => {
    const coach = run(feedback(lessonSession(), graded(101, "correct", { combo: 5 })), { type: "CONTINUE" });
    const fresh = lessonSession({ currentItemId: 103 });
    const state = run(coach, { type: "SYNCED", session: fresh });
    expect(state.phase).toEqual({ name: "answering" });
    expect(shownItem(state)?.id).toBe(103);
    expect(state.coachShown).toEqual(["combo5"]);
    expect(state.reviewable).toBe(false);
  });
});

describe("the review record", () => {
  it("keeps what was submitted and the correct answer for each graded item", () => {
    const right = feedback(lessonSession(), graded(101, "correct"));
    const wrong = run(
      feedback(lessonSession(), graded(102, "incorrect", { state: { currentItemId: 103 } }), run(right, { type: "CONTINUE" })),
      { type: "CONTINUE" },
    );
    const skipped = run(wrong, { type: "SKIP" }, {
      type: "ANSWER_OK",
      result: graded(103, "skipped", { correctAnswer: "Quiero agua." }),
    });
    expect(skipped.answers).toEqual([
      { itemId: 101, prompt: "Which one of these is “the juice”?", given: "el jugo", correctAnswer: null, correct: true },
      { itemId: 102, prompt: "Yo bebo agua.", given: "I drink water", correctAnswer: "I drink water.", correct: false },
      { itemId: 103, prompt: "Type what you hear", given: "Skipped", correctAnswer: "Quiero agua.", correct: false },
    ]);
  });
});
