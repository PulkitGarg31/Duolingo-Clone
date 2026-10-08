import { describe, expect, it } from "vitest";
import type { MatchPairsExercise, MultipleChoiceExercise, TranslateExercise, TypeAnswerExercise } from "@/lib/api/types";
import { answerPayload, isDraftComplete } from "./answerPayload";

const choice: MultipleChoiceExercise = {
  id: 69,
  type: "multiple_choice",
  instruction: "Which one of these is “the juice”?",
  prompt: null,
  layout: "pictures",
  options: [{ id: 302, text: "el jugo", imageKey: "juice" }],
};

const translate: TranslateExercise = {
  id: 70,
  type: "translate",
  instruction: "Write this in English",
  prompt: { text: "Yo bebo agua.", language: "es", speak: true, segments: [] },
  answerLanguage: "en",
  tiles: [{ id: 313, text: "I" }],
  specialCharacters: [],
};

const match: MatchPairsExercise = {
  id: 71,
  type: "match_pairs",
  instruction: "Tap the matching pairs",
  left: [
    { id: 41, text: "el té" },
    { id: 42, text: "el agua" },
  ],
  right: [
    { id: 42, text: "the water" },
    { id: 41, text: "the tea" },
  ],
};

const typing: TypeAnswerExercise = {
  id: 74,
  type: "type_answer",
  instruction: "Write this in Spanish",
  prompt: { text: "I want water.", language: "en", speak: false, segments: [] },
  audioOnly: false,
  answerLanguage: "es",
  specialCharacters: ["á"],
};

describe("answerPayload", () => {
  it("sends the picked option", () => {
    expect(answerPayload({ type: "multiple_choice", optionId: 302 })).toEqual({ type: "multiple_choice", optionId: 302 });
    expect(answerPayload({ type: "fill_blank", optionId: 322 })).toEqual({ type: "fill_blank", optionId: 322 });
  });

  it("keeps word-bank tiles in answer order", () => {
    expect(answerPayload({ type: "translate", mode: "tiles", tileIds: [313, 315, 311] })).toEqual({
      type: "translate",
      tileIds: [313, 315, 311],
    });
  });

  it("trims keyboard text for both typed exercise types", () => {
    expect(answerPayload({ type: "translate", mode: "keyboard", text: "  I drink water.\n" })).toEqual({
      type: "translate",
      text: "I drink water.",
    });
    expect(answerPayload({ type: "type_answer", text: " Quiero agua " })).toEqual({
      type: "type_answer",
      text: "Quiero agua",
    });
  });

  it("sends every matched pair with the mistake count", () => {
    expect(
      answerPayload({
        type: "match_pairs",
        matched: [
          { leftId: 42, rightId: 42 },
          { leftId: 41, rightId: 41 },
        ],
        mistakes: 2,
      }),
    ).toEqual({
      type: "match_pairs",
      pairs: [
        { leftId: 42, rightId: 42 },
        { leftId: 41, rightId: 41 },
      ],
      mistakes: 2,
    });
  });

  it("never shares arrays with the draft", () => {
    const tileIds = [313];
    const payload = answerPayload({ type: "translate", mode: "tiles", tileIds });
    tileIds.push(999);
    expect(payload).toEqual({ type: "translate", tileIds: [313] });
  });
});

describe("isDraftComplete", () => {
  it("is false without a draft", () => {
    expect(isDraftComplete(null, choice)).toBe(false);
  });

  it("is true once an option is picked", () => {
    expect(isDraftComplete({ type: "multiple_choice", optionId: 302 }, choice)).toBe(true);
  });

  it("needs at least one tile in the answer", () => {
    expect(isDraftComplete({ type: "translate", mode: "tiles", tileIds: [] }, translate)).toBe(false);
    expect(isDraftComplete({ type: "translate", mode: "tiles", tileIds: [313] }, translate)).toBe(true);
  });

  it("needs typed text that is not just whitespace", () => {
    expect(isDraftComplete({ type: "translate", mode: "keyboard", text: "   " }, translate)).toBe(false);
    expect(isDraftComplete({ type: "translate", mode: "keyboard", text: "I" }, translate)).toBe(true);
    expect(isDraftComplete({ type: "type_answer", text: "\n" }, typing)).toBe(false);
    expect(isDraftComplete({ type: "type_answer", text: "Quiero" }, typing)).toBe(true);
  });

  it("needs every pair matched", () => {
    expect(isDraftComplete({ type: "match_pairs", matched: [{ leftId: 41, rightId: 41 }], mistakes: 0 }, match)).toBe(
      false,
    );
    expect(
      isDraftComplete(
        {
          type: "match_pairs",
          matched: [
            { leftId: 41, rightId: 41 },
            { leftId: 42, rightId: 42 },
          ],
          mistakes: 0,
        },
        match,
      ),
    ).toBe(true);
  });

  it("is false when the draft belongs to another exercise type", () => {
    expect(isDraftComplete({ type: "type_answer", text: "Quiero" }, translate)).toBe(false);
    expect(isDraftComplete({ type: "fill_blank", optionId: 302 }, choice)).toBe(false);
  });
});
