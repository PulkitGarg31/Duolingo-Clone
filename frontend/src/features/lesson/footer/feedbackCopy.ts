import type { AnswerResultOut, ExerciseType, GradeNote } from "@/lib/api/types";
import { highlightCharacters, highlightWords, type Highlighted } from "./highlight";

export type FeedbackTone = "correct" | "incorrect" | "skipped";

/** The words of the feedback bar after a graded answer. */
export interface FeedbackCopy {
  tone: FeedbackTone;
  title: string;
  /** A bold line before the solution ("You have a typo."). */
  lead: string | null;
  /** The solution, with the learner's differences marked. */
  solution: Highlighted[] | null;
  /** Lines after the solution: what went wrong and the sentence's meaning. */
  tail: string[];
}

export const PRAISE = [
  "Nice!",
  "Nice job!",
  "Good job!",
  "Great job!",
  "Excellent!",
  "Amazing!",
  "Awesome!",
  "Nicely done!",
  "Great!",
  "Correct!",
] as const;

/** Praise picked by item id: the same item always gets the same words, consecutive items never do. */
export function praiseFor(itemId: number): string {
  return PRAISE[itemId % PRAISE.length];
}

const CORRECT_LEADS: Partial<Record<GradeNote, string>> = {
  alternate: "Another correct solution:",
  typo: "You have a typo.",
  accent: "Pay attention to the accents.",
};

const WRONG_NOTES: Partial<Record<GradeNote, string>> = {
  missing_word: "You missed a word.",
  wrong_word: "You used the wrong word.",
};

/** Typed and word-bank answers are sentences, so their differences are worth marking word by word. */
const SENTENCE_ANSWERS: ReadonlySet<ExerciseType> = new Set(["translate", "type_answer"]);

const plain = (text: string): Highlighted[] => [{ text, changed: false }];

/**
 * What the feedback bar says: praise for a right answer (with the accepted solution when the answer was an
 * alternate, a typo or missed accents), the solution for a wrong or skipped one.
 */
export function feedbackCopy(result: AnswerResultOut, given: string, exerciseType: ExerciseType): FeedbackCopy {
  const { correctAnswer, note } = result;
  if (result.isCorrect) {
    const lead = (note && CORRECT_LEADS[note]) ?? null;
    const solution = !lead || !correctAnswer ? null : note === "alternate" ? plain(correctAnswer) : highlightCharacters(given, correctAnswer);
    return { tone: "correct", title: praiseFor(result.itemId), lead, solution, tail: [] };
  }
  const tone: FeedbackTone = result.result === "skipped" ? "skipped" : "incorrect";
  if (!correctAnswer) return { tone, title: tone === "skipped" ? "Skipped" : "Incorrect", lead: null, solution: null, tail: [] };
  const marked = tone === "incorrect" && SENTENCE_ANSWERS.has(exerciseType);
  const tail = [note ? WRONG_NOTES[note] : undefined, result.meaning ? `Meaning: ${result.meaning}` : undefined];
  return {
    tone,
    title: "Correct solution:",
    lead: null,
    solution: marked ? highlightWords(given, correctAnswer) : plain(correctAnswer),
    tail: tail.filter((line): line is string => line !== undefined),
  };
}
