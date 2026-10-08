import type { ExerciseOut } from "@/lib/api/types";

/** A pair the learner matched; both sides carry the pair's id. */
export interface MatchedPair {
  leftId: number;
  rightId: number;
}

/**
 * What the learner has entered for the current exercise, before CHECK. It holds ids and text only: the
 * client never knows which answer is right.
 */
export type AnswerDraft =
  | { type: "multiple_choice"; optionId: number }
  | { type: "fill_blank"; optionId: number }
  | { type: "translate"; mode: "tiles"; tileIds: number[] }
  | { type: "translate"; mode: "keyboard"; text: string }
  | { type: "match_pairs"; matched: MatchedPair[]; mistakes: number }
  | { type: "type_answer"; text: string };

export type TranslateMode = "tiles" | "keyboard";

export function withOption(type: "multiple_choice" | "fill_blank", optionId: number): AnswerDraft {
  return { type, optionId };
}

/** The word-bank tiles in the answer, in order; empty for any other draft. */
export function tileIdsOf(draft: AnswerDraft | null): number[] {
  return draft?.type === "translate" && draft.mode === "tiles" ? draft.tileIds : [];
}

/** A tapped bank tile goes to the end of the answer. Each tile can be used once. */
export function withTile(draft: AnswerDraft | null, tileId: number): AnswerDraft {
  const tileIds = tileIdsOf(draft);
  return { type: "translate", mode: "tiles", tileIds: tileIds.includes(tileId) ? tileIds : [...tileIds, tileId] };
}

/** A tapped answer tile goes back to the bank. */
export function withoutTile(draft: AnswerDraft | null, tileId: number): AnswerDraft {
  return { type: "translate", mode: "tiles", tileIds: tileIdsOf(draft).filter((id) => id !== tileId) };
}

export function withKeyboardText(type: "translate" | "type_answer", text: string): AnswerDraft {
  return type === "translate" ? { type, mode: "keyboard", text } : { type, text };
}

/** USE KEYBOARD ⇄ USE WORD BANK. The answer starts over in the new mode. */
export function withTranslateMode(draft: AnswerDraft | null, mode: TranslateMode): AnswerDraft {
  if (draft?.type === "translate" && draft.mode === mode) return draft;
  return mode === "tiles" ? { type: "translate", mode, tileIds: [] } : { type: "translate", mode, text: "" };
}

function matchDraft(draft: AnswerDraft | null): Extract<AnswerDraft, { type: "match_pairs" }> {
  return draft?.type === "match_pairs" ? draft : { type: "match_pairs", matched: [], mistakes: 0 };
}

/** Records a correct pair (the two taps carried the same id). */
export function withMatch(draft: AnswerDraft | null, pair: MatchedPair): AnswerDraft {
  const current = matchDraft(draft);
  const known = current.matched.some((matched) => matched.leftId === pair.leftId);
  return known ? current : { ...current, matched: [...current.matched, pair] };
}

/** Counts a wrong pair. It costs no heart; the count only feeds the lesson statistics. */
export function withMistake(draft: AnswerDraft | null): AnswerDraft {
  const current = matchDraft(draft);
  return { ...current, mistakes: current.mistakes + 1 };
}

/**
 * The learner's answer as text, for the feedback highlight and the review scorecard: the picked option, the
 * sentence with its blank filled, the tiles in order, the typed text or the matched pairs.
 */
export function describeAnswer(exercise: ExerciseOut, draft: AnswerDraft | null): string {
  if (!draft || draft.type !== exercise.type) return "";
  switch (exercise.type) {
    case "multiple_choice":
      return draft.type === "multiple_choice" ? textOf(exercise.options, draft.optionId) : "";
    case "fill_blank":
      if (draft.type !== "fill_blank") return "";
      return [exercise.before, textOf(exercise.options, draft.optionId), exercise.after].filter(Boolean).join(" ");
    case "translate":
      if (draft.type !== "translate") return "";
      return draft.mode === "keyboard"
        ? draft.text.trim()
        : draft.tileIds.map((id) => textOf(exercise.tiles, id)).join(" ");
    case "type_answer":
      return draft.type === "type_answer" ? draft.text.trim() : "";
    case "match_pairs":
      if (draft.type !== "match_pairs") return "";
      return draft.matched
        .map(({ leftId, rightId }) => `${textOf(exercise.left, leftId)} = ${textOf(exercise.right, rightId)}`)
        .join(", ");
  }
}

function textOf(entries: readonly { id: number; text: string }[], id: number): string {
  return entries.find((entry) => entry.id === id)?.text ?? "";
}
