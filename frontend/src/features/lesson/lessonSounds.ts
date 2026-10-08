import type { ItemResult } from "@/lib/api/types";
import type { AnswerDraft } from "@/lib/lesson/answerDraft";
import type { SoundName } from "@/lib/sound";

/**
 * The sound a draft change makes on its own. Only match pairs has one: a blip for a matched pair, a buzz for
 * a wrong one. Every other change comes from a tap, which plays the tap sound itself.
 */
export function draftSound(previous: AnswerDraft | null, next: AnswerDraft | null): SoundName | null {
  if (next?.type !== "match_pairs") return null;
  const before = previous?.type === "match_pairs" ? previous : { matched: [], mistakes: 0 };
  if (next.matched.length > before.matched.length) return "matchCorrect";
  if (next.mistakes > before.mistakes) return "matchWrong";
  return null;
}

/** The verdict's sound, played as the feedback bar appears. CAN'T LISTEN NOW has none. */
export function answerSound(result: ItemResult): SoundName | null {
  switch (result) {
    case "correct":
      return "correct";
    case "incorrect":
    case "skipped":
      return "incorrect";
    case "cant_listen":
      return null;
  }
}
