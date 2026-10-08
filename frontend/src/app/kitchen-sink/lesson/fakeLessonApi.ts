import type { LessonApi } from "@/features/lesson/lessonApi";
import { ApiError, type ApiErrorCode } from "@/lib/api/errors";
import type {
  AnswerIn,
  AnswerResultOut,
  CompletionOut,
  ExerciseOut,
  GradeNote,
  ItemResult,
  SessionItemOut,
  SessionOut,
} from "@/lib/api/types";
import { ANSWER_KEY, COMPLETION, MEANINGS } from "./fixtures";

/*
 * A pretend server for the interactive previews: it grades against the fixtures' answer key and applies the
 * lesson rules (hearts and retries, Legendary's three lives, the timed clock) closely enough to walk through
 * every screen of the player without a backend.
 */

const LATENCY_MS = 300;
const LEGENDARY_LIVES = 3;

interface Grade {
  result: ItemResult;
  note: GradeNote | null;
  correctAnswer: string | null;
}

const wait = () => new Promise((resolve) => setTimeout(resolve, LATENCY_MS));

function failure(status: number, code: ApiErrorCode): ApiError {
  return new ApiError({ status, code, title: code, detail: code });
}

/** Lower case, no punctuation; `strict` keeps the accents. */
function comparable(text: string, strict: boolean): string {
  const letters = strict ? text : text.normalize("NFD").replace(/\p{M}/gu, "");
  return letters.toLocaleLowerCase("es").replace(/[^\p{L}\p{N}\s']/gu, "").replace(/\s+/g, " ").trim();
}

function solutionOf(exercise: ExerciseOut): string | null {
  const key = ANSWER_KEY[exercise.id];
  switch (exercise.type) {
    case "multiple_choice":
      return exercise.options.find((option) => option.id === key)?.text ?? null;
    case "fill_blank": {
      const choice = exercise.options.find((option) => option.id === key)?.text ?? "";
      return [exercise.before, choice, exercise.after].join(" ");
    }
    case "match_pairs":
      return null;
    case "translate":
    case "type_answer":
      return typeof key === "string" ? key : null;
  }
}

function grade(exercise: ExerciseOut, answer: AnswerIn): Grade {
  const correctAnswer = solutionOf(exercise);
  if (answer.type === "skip") return { result: "skipped", note: null, correctAnswer };
  if (answer.type === "cant_listen") return { result: "cant_listen", note: null, correctAnswer };
  const verdict = (correct: boolean, note: GradeNote | null = null): Grade => ({
    result: correct ? "correct" : "incorrect",
    note,
    correctAnswer,
  });
  if (answer.type === "match_pairs") return verdict(true);
  if (answer.type === "multiple_choice" || answer.type === "fill_blank") return verdict(answer.optionId === ANSWER_KEY[exercise.id]);
  const given =
    answer.type === "translate" && answer.tileIds && exercise.type === "translate"
      ? answer.tileIds.map((id) => exercise.tiles.find((tile) => tile.id === id)?.text ?? "").join(" ")
      : (answer.text ?? "");
  const expected = correctAnswer ?? "";
  if (comparable(given, true) === comparable(expected, true)) return verdict(true);
  if (comparable(given, false) === comparable(expected, false)) return verdict(true, "accent");
  return verdict(false);
}

function isListening(item: SessionItemOut): boolean {
  return item.exercise.type === "type_answer" && item.exercise.audioOnly;
}

/** Each initial exercise counts once it was answered right (or skipped as a listening item). */
function progressOf(session: SessionOut): SessionOut["progress"] {
  const initial = session.items.filter((item) => item.origin === "initial");
  if (session.kind === "timed") {
    return { completed: session.items.filter((item) => item.result === "correct").length, total: initial.length };
  }
  const resolved = initial.filter((first) => {
    const attempts = session.items.filter((item) => item.exercise.id === first.exercise.id);
    const done = attempts.some((item) => item.result === "correct" || item.result === "cant_listen");
    return done || (session.kind !== "lesson" && attempts.every((item) => item.result !== null));
  });
  return { completed: resolved.length, total: initial.length };
}

export interface FakeLessonApiOptions {
  /** TRY AGAIN after a failed Legendary run starts over. */
  onRestart(): void;
}

export function createFakeLessonApi(start: SessionOut, { onRestart }: FakeLessonApiOptions): LessonApi {
  let session: SessionOut = structuredClone(start);
  let nextItemId = Math.max(...session.items.map((item) => item.id)) + 1;

  function apply(target: SessionItemOut, outcome: Grade): { heartLost: boolean; appendedItem: SessionItemOut | null } {
    target.result = outcome.result;
    target.note = outcome.note;
    if (outcome.result === "cant_listen") {
      for (const item of session.items) if (item.result === null && isListening(item)) item.result = "cant_listen";
    }
    const wrong = outcome.result === "incorrect" || outcome.result === "skipped";
    let heartLost = false;
    let appendedItem: SessionItemOut | null = null;
    if (outcome.result === "correct") {
      session.combo += 1;
      session.bestCombo = Math.max(session.bestCombo, session.combo);
      const bonus = session.timer?.bonusSeconds[target.exercise.type] ?? 0;
      if (session.timer && bonus) {
        session.timer.expiresAt = new Date(Date.parse(session.timer.expiresAt) + bonus * 1000).toISOString();
      }
    } else if (wrong) {
      session.combo = 0;
      session.mistakes += 1;
    }
    if (wrong && session.kind === "lesson") {
      heartLost = session.hearts.current > 0;
      session.hearts = { ...session.hearts, current: Math.max(0, session.hearts.current - 1) };
      if (session.hearts.current === 0) session.blockedReason = "OUT_OF_HEARTS";
    }
    const retriedBefore = session.items.some((item) => item.origin === "retry" && item.exercise.id === target.exercise.id);
    if (wrong && (session.kind === "lesson" || (session.kind === "practice" && !retriedBefore))) {
      const seq = Math.max(...session.items.map((item) => item.seq)) + 1;
      appendedItem = { ...target, id: nextItemId++, seq, origin: "retry", label: "previous_mistake", result: null, note: null };
      session.items.push(appendedItem);
    }
    if (session.kind === "legendary" && session.lives) {
      session.lives = { ...session.lives, left: Math.max(0, LEGENDARY_LIVES - session.mistakes) };
      if (session.mistakes >= LEGENDARY_LIVES) {
        session.status = "failed";
        session.endReason = "too_many_mistakes";
      }
    }
    session.progress = progressOf(session);
    const next = session.items.filter((item) => item.result === null).sort((a, b) => a.seq - b.seq)[0];
    session.currentItemId = session.status === "active" ? (next?.id ?? null) : null;
    session.canComplete = session.status === "active" && !session.blockedReason && session.currentItemId === null;
    return { heartLost, appendedItem };
  }

  function receipt(): CompletionOut {
    const correct = session.items.filter((item) => item.result === "correct").length;
    const graded = session.items.filter((item) => item.result === "correct" || item.result === "incorrect" || item.result === "skipped");
    const accuracy = graded.length === 0 ? 100 : Math.floor((100 * correct) / graded.length + 0.5);
    const base: CompletionOut = {
      ...COMPLETION,
      sessionId: session.id,
      kind: session.kind,
      stats: { ...COMPLETION.stats, accuracyPercent: accuracy, mistakes: session.mistakes, perfect: session.mistakes === 0, bestCombo: session.bestCombo },
    };
    if (session.kind === "timed") {
      return {
        ...base,
        xp: { total: correct, lines: correct ? [{ reason: "timed", amount: correct }] : [], boostActive: false },
        node: null,
        achievementsUnlocked: [],
        timed: { correct, answered: graded.length, timeUp: true },
      };
    }
    if (session.kind === "legendary" && base.node) {
      return { ...base, xp: { total: 40, lines: [{ reason: "legendary", amount: 40 }], boostActive: false }, node: { ...base.node, legendaryNow: true } };
    }
    return base;
  }

  return {
    async submitAnswer(_sessionId, itemId, answer) {
      await wait();
      const target = session.items.find((item) => item.id === itemId);
      if (!target) throw failure(404, "NOT_FOUND");
      if (session.status !== "active") throw failure(409, "SESSION_NOT_ACTIVE");
      if (session.blockedReason) throw failure(409, "OUT_OF_HEARTS");
      const outcome = grade(target.exercise, answer);
      const { heartLost, appendedItem } = apply(target, outcome);
      const result: AnswerResultOut = {
        itemId,
        replayed: false,
        result: outcome.result,
        isCorrect: outcome.result === "correct",
        note: outcome.note,
        correctAnswer: outcome.correctAnswer,
        meaning: MEANINGS[target.exercise.id] ?? null,
        heartLost,
        hearts: session.hearts,
        progress: session.progress,
        mistakes: session.mistakes,
        combo: session.combo,
        bestCombo: session.bestCombo,
        appendedItem: appendedItem && structuredClone(appendedItem),
        session: {
          status: session.status,
          endReason: session.endReason,
          blockedReason: session.blockedReason,
          canComplete: session.canComplete,
          currentItemId: session.currentItemId,
          livesLeft: session.lives?.left ?? null,
          expiresAt: session.timer?.expiresAt ?? null,
        },
      };
      return structuredClone(result);
    },
    async complete() {
      await wait();
      session = { ...session, status: "completed", endReason: "passed" };
      return receipt();
    },
    async quit() {
      await wait();
      return { sessionId: session.id, status: "abandoned", endReason: "quit", replayed: false, hearts: session.hearts };
    },
    async refillHearts() {
      await wait();
      session.hearts = { ...session.hearts, current: session.hearts.max, nextHeartAt: null, fullAt: null };
      session.blockedReason = null;
      session.canComplete = session.currentItemId === null;
      return {
        id: 1,
        itemCode: "heart_refill",
        priceGems: session.hearts.refillPriceGems,
        purchasedAt: new Date().toISOString(),
        replayed: false,
        gems: 470,
        effect: { hearts: session.hearts, streakFreezes: 1, xpBoostUntil: null },
      };
    },
    async reload() {
      return structuredClone(session);
    },
    async startLegendary() {
      await wait();
      onRestart();
      return structuredClone(start);
    },
  };
}
