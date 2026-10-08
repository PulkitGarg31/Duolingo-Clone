import { describe, expect, it } from "vitest";
import { answerSound, draftSound } from "./lessonSounds";

describe("draftSound", () => {
  it("blips for a matched pair and buzzes for a wrong one", () => {
    expect(draftSound(null, { type: "match_pairs", matched: [{ leftId: 1, rightId: 1 }], mistakes: 0 })).toBe("matchCorrect");
    expect(
      draftSound(
        { type: "match_pairs", matched: [], mistakes: 0 },
        { type: "match_pairs", matched: [], mistakes: 1 },
      ),
    ).toBe("matchWrong");
  });

  it("stays silent for other draft changes (their taps make the sound)", () => {
    expect(draftSound(null, { type: "multiple_choice", optionId: 1 })).toBeNull();
    expect(draftSound({ type: "translate", mode: "tiles", tileIds: [] }, { type: "translate", mode: "tiles", tileIds: [2] })).toBeNull();
    expect(draftSound({ type: "match_pairs", matched: [], mistakes: 0 }, null)).toBeNull();
  });
});

describe("answerSound", () => {
  it("chimes for a correct answer and bonks for a wrong or skipped one", () => {
    expect(answerSound("correct")).toBe("correct");
    expect(answerSound("incorrect")).toBe("incorrect");
    expect(answerSound("skipped")).toBe("incorrect");
  });

  it("is silent when listening was skipped", () => {
    expect(answerSound("cant_listen")).toBeNull();
  });
});
