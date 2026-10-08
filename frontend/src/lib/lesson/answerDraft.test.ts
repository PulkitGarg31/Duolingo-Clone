import { describe, expect, it } from "vitest";
import type {
  FillBlankExercise,
  MatchPairsExercise,
  MultipleChoiceExercise,
  TranslateExercise,
  TypeAnswerExercise,
} from "@/lib/api/types";
import {
  describeAnswer,
  tileIdsOf,
  withKeyboardText,
  withMatch,
  withMistake,
  withOption,
  withTile,
  withTranslateMode,
  withoutTile,
  type AnswerDraft,
} from "./answerDraft";

const pictures: MultipleChoiceExercise = {
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

const translate: TranslateExercise = {
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

const fill: FillBlankExercise = {
  id: 72,
  type: "fill_blank",
  instruction: "Fill in the blank",
  prompt: { text: "Tú ___ agua.", language: "es", speak: true, segments: [] },
  before: "Tú",
  after: "agua.",
  translation: "You drink water.",
  options: [
    { id: 321, text: "bebo" },
    { id: 322, text: "bebes" },
  ],
};

const typing: TypeAnswerExercise = {
  id: 74,
  type: "type_answer",
  instruction: "Type what you hear",
  prompt: { text: "Quiero agua.", language: "es", speak: true, segments: [] },
  audioOnly: true,
  answerLanguage: "es",
  specialCharacters: ["á"],
};

describe("word-bank tiles", () => {
  it("appends tiles in tap order and ignores a tile already in the answer", () => {
    let draft: AnswerDraft | null = null;
    draft = withTile(draft, 313);
    draft = withTile(draft, 315);
    draft = withTile(draft, 313);
    expect(draft).toEqual({ type: "translate", mode: "tiles", tileIds: [313, 315] });
  });

  it("removes a tapped answer tile and keeps the others in order", () => {
    const draft = withoutTile({ type: "translate", mode: "tiles", tileIds: [313, 315, 311] }, 315);
    expect(draft).toEqual({ type: "translate", mode: "tiles", tileIds: [313, 311] });
  });

  it("reads the tile ids of a word-bank answer only", () => {
    expect(tileIdsOf({ type: "translate", mode: "tiles", tileIds: [1, 2] })).toEqual([1, 2]);
    expect(tileIdsOf({ type: "translate", mode: "keyboard", text: "x" })).toEqual([]);
    expect(tileIdsOf(null)).toEqual([]);
  });
});

describe("keyboard and mode switch", () => {
  it("switches between the word bank and the keyboard with an empty answer", () => {
    const tiles: AnswerDraft = { type: "translate", mode: "tiles", tileIds: [313] };
    expect(withTranslateMode(tiles, "keyboard")).toEqual({ type: "translate", mode: "keyboard", text: "" });
    expect(withTranslateMode(withKeyboardText("translate", "I drink"), "tiles")).toEqual({
      type: "translate",
      mode: "tiles",
      tileIds: [],
    });
  });

  it("keeps the draft when the mode does not change", () => {
    const tiles: AnswerDraft = { type: "translate", mode: "tiles", tileIds: [313] };
    expect(withTranslateMode(tiles, "tiles")).toBe(tiles);
  });

  it("builds typed drafts for both exercise types", () => {
    expect(withKeyboardText("translate", "I drink water")).toEqual({
      type: "translate",
      mode: "keyboard",
      text: "I drink water",
    });
    expect(withKeyboardText("type_answer", "Quiero")).toEqual({ type: "type_answer", text: "Quiero" });
  });

});

describe("choices and pairs", () => {
  it("picks one option for multiple choice and fill in the blank", () => {
    expect(withOption("multiple_choice", 302)).toEqual({ type: "multiple_choice", optionId: 302 });
    expect(withOption("fill_blank", 322)).toEqual({ type: "fill_blank", optionId: 322 });
  });

  it("collects matched pairs once each and counts mistakes", () => {
    let draft: AnswerDraft | null = null;
    draft = withMatch(draft, { leftId: 41, rightId: 41 });
    draft = withMistake(draft);
    draft = withMatch(draft, { leftId: 41, rightId: 41 });
    draft = withMatch(draft, { leftId: 42, rightId: 42 });
    expect(draft).toEqual({
      type: "match_pairs",
      matched: [
        { leftId: 41, rightId: 41 },
        { leftId: 42, rightId: 42 },
      ],
      mistakes: 1,
    });
  });
});

describe("describeAnswer", () => {
  it("names the picked option", () => {
    expect(describeAnswer(pictures, { type: "multiple_choice", optionId: 302 })).toBe("el jugo");
  });

  it("joins the tiles in answer order", () => {
    expect(describeAnswer(translate, { type: "translate", mode: "tiles", tileIds: [313, 315, 311] })).toBe(
      "I drink water",
    );
  });

  it("trims typed text", () => {
    expect(describeAnswer(translate, withKeyboardText("translate", "  I drink water. "))).toBe("I drink water.");
    expect(describeAnswer(typing, withKeyboardText("type_answer", " Quiero agua "))).toBe("Quiero agua");
  });

  it("fills the blank into the sentence", () => {
    expect(describeAnswer(fill, { type: "fill_blank", optionId: 322 })).toBe("Tú bebes agua.");
  });

  it("lists matched pairs", () => {
    const draft: AnswerDraft = {
      type: "match_pairs",
      matched: [
        { leftId: 41, rightId: 41 },
        { leftId: 42, rightId: 42 },
      ],
      mistakes: 0,
    };
    expect(describeAnswer(match, draft)).toBe("el té = the tea, el agua = the water");
  });

  it("is empty without an answer or when the draft belongs to another type", () => {
    expect(describeAnswer(translate, null)).toBe("");
    expect(describeAnswer(pictures, { type: "fill_blank", optionId: 302 })).toBe("");
  });
});
