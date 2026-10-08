import { describe, expect, it } from "vitest";
import type { AnswerResultOut, HeartsOut } from "@/lib/api/types";
import { PRAISE, feedbackCopy, praiseFor } from "./feedbackCopy";
import { highlightCharacters, highlightWords } from "./highlight";

const HEARTS: HeartsOut = {
  current: 5,
  max: 5,
  nextHeartAt: null,
  fullAt: null,
  regenIntervalSeconds: 18000,
  refillPriceGems: 350,
};

function result(extra: Partial<AnswerResultOut>): AnswerResultOut {
  return {
    itemId: 102,
    replayed: false,
    result: "correct",
    isCorrect: true,
    note: null,
    correctAnswer: null,
    meaning: null,
    heartLost: false,
    hearts: HEARTS,
    progress: { completed: 1, total: 6 },
    mistakes: 0,
    combo: 1,
    bestCombo: 1,
    appendedItem: null,
    session: {
      status: "active",
      endReason: null,
      blockedReason: null,
      canComplete: false,
      currentItemId: 103,
      livesLeft: null,
      expiresAt: null,
    },
    ...extra,
  };
}

const changed = (segments: { text: string; changed: boolean }[]) =>
  segments.filter((segment) => segment.changed).map((segment) => segment.text);

describe("highlightWords", () => {
  it("marks the solution's words the answer lacks", () => {
    expect(changed(highlightWords("I eat water", "I drink water."))).toEqual(["drink"]);
  });

  it("ignores case, punctuation and accents", () => {
    expect(changed(highlightWords("i drink WATER", "I drink water."))).toEqual([]);
    expect(changed(highlightWords("Como estas", "¿Cómo estás?"))).toEqual([]);
  });

  it("keeps the solution's text exactly, separators included", () => {
    const segments = highlightWords("Yo bebo", "Yo bebo agua.");
    expect(segments.map((segment) => segment.text).join("")).toBe("Yo bebo agua.");
    expect(changed(segments)).toEqual(["agua"]);
  });

  it("marks everything when nothing was given", () => {
    expect(changed(highlightWords("", "Hola"))).toEqual(["Hola"]);
  });
});

describe("highlightCharacters", () => {
  it("marks a missing accent", () => {
    expect(changed(highlightCharacters("dias", "días"))).toEqual(["í"]);
  });

  it("marks the letters a typo got wrong", () => {
    expect(changed(highlightCharacters("Buenas noshes", "Buenas noches"))).toEqual(["c"]);
  });

  it("ignores case", () => {
    expect(changed(highlightCharacters("hola", "Hola"))).toEqual([]);
  });
});

describe("praiseFor", () => {
  it("is the same for the same item and differs between consecutive items", () => {
    expect(praiseFor(102)).toBe(praiseFor(102));
    expect(praiseFor(102)).not.toBe(praiseFor(103));
    expect(PRAISE).toContain(praiseFor(7));
  });
});

describe("feedbackCopy", () => {
  it("praises a correct answer and shows nothing else", () => {
    expect(feedbackCopy(result({}), "el jugo", "multiple_choice")).toEqual({
      tone: "correct",
      title: praiseFor(102),
      lead: null,
      solution: null,
      tail: [],
    });
  });

  it("shows the other accepted answer after an alternate", () => {
    const copy = feedbackCopy(result({ note: "alternate", correctAnswer: "I drink water." }), "I am drinking water", "translate");
    expect(copy.lead).toBe("Another correct solution:");
    expect(copy.solution).toEqual([{ text: "I drink water.", changed: false }]);
  });

  it("points at a typo and an accent in the answer", () => {
    const typo = feedbackCopy(result({ note: "typo", correctAnswer: "Buenas noches" }), "Buenas noshes", "type_answer");
    expect(typo.lead).toBe("You have a typo.");
    expect(changed(typo.solution ?? [])).toEqual(["c"]);
    const accent = feedbackCopy(result({ note: "accent", correctAnswer: "Buenos días" }), "Buenos dias", "type_answer");
    expect(accent.lead).toBe("Pay attention to the accents.");
    expect(changed(accent.solution ?? [])).toEqual(["í"]);
  });

  it("gives the solution of a wrong answer with the words that differ", () => {
    const copy = feedbackCopy(
      result({ result: "incorrect", isCorrect: false, note: "wrong_word", correctAnswer: "I drink water." }),
      "I eat water",
      "translate",
    );
    expect(copy.tone).toBe("incorrect");
    expect(copy.title).toBe("Correct solution:");
    expect(changed(copy.solution ?? [])).toEqual(["drink"]);
    expect(copy.tail).toEqual(["You used the wrong word."]);
  });

  it("keeps a picked option's solution plain", () => {
    const copy = feedbackCopy(
      result({ result: "incorrect", isCorrect: false, correctAnswer: "el jugo" }),
      "el agua",
      "multiple_choice",
    );
    expect(copy.solution).toEqual([{ text: "el jugo", changed: false }]);
  });

  it("adds the meaning of a listening sentence and the missing-word message", () => {
    const copy = feedbackCopy(
      result({ result: "incorrect", isCorrect: false, note: "missing_word", correctAnswer: "Quiero agua.", meaning: "I want water." }),
      "Quiero",
      "type_answer",
    );
    expect(copy.tail).toEqual(["You missed a word.", "Meaning: I want water."]);
  });

  it("shows the solution of a skipped item in the skip colours", () => {
    const copy = feedbackCopy(
      result({ result: "skipped", isCorrect: false, correctAnswer: "Tú bebes agua." }),
      "",
      "fill_blank",
    );
    expect(copy).toMatchObject({ tone: "skipped", title: "Correct solution:" });
    expect(copy.solution).toEqual([{ text: "Tú bebes agua.", changed: false }]);
  });

  it("says Skipped when there is no single solution to show (match pairs)", () => {
    const copy = feedbackCopy(result({ result: "skipped", isCorrect: false, correctAnswer: null }), "", "match_pairs");
    expect(copy).toMatchObject({ tone: "skipped", title: "Skipped", solution: null });
  });
});
