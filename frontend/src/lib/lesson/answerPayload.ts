import type { AnswerIn, ExerciseOut } from "@/lib/api/types";
import type { AnswerDraft } from "./answerDraft";

/**
 * The request body for a draft (`PUT …/answer`). Tiles keep their order, typed text is trimmed and a match
 * sends every pair with the mistake count. Arrays are copied so later draft edits cannot change a request.
 */
export function answerPayload(draft: AnswerDraft): AnswerIn {
  switch (draft.type) {
    case "multiple_choice":
    case "fill_blank":
      return { type: draft.type, optionId: draft.optionId };
    case "translate":
      return draft.mode === "tiles"
        ? { type: "translate", tileIds: [...draft.tileIds] }
        : { type: "translate", text: draft.text.trim() };
    case "match_pairs":
      return {
        type: "match_pairs",
        pairs: draft.matched.map(({ leftId, rightId }) => ({ leftId, rightId })),
        mistakes: draft.mistakes,
      };
    case "type_answer":
      return { type: "type_answer", text: draft.text.trim() };
  }
}

/** Whether CHECK can be pressed: something answers the current exercise. A match needs every pair. */
export function isDraftComplete(draft: AnswerDraft | null, exercise: ExerciseOut): draft is AnswerDraft {
  if (!draft || draft.type !== exercise.type) return false;
  switch (draft.type) {
    case "multiple_choice":
    case "fill_blank":
      return true;
    case "translate":
      return draft.mode === "tiles" ? draft.tileIds.length > 0 : draft.text.trim() !== "";
    case "type_answer":
      return draft.text.trim() !== "";
    case "match_pairs":
      return exercise.type === "match_pairs" && draft.matched.length === exercise.left.length;
  }
}
