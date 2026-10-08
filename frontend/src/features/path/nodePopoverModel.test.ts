import { describe, expect, it } from "vitest";
import { makeNode } from "./testNodes";
import { nodePopoverModel } from "./nodePopoverModel";

describe("nodePopoverModel", () => {
  it("offers START with the lesson number on the active skill", () => {
    const node = makeNode({
      state: "active",
      lessonsCompleted: 1,
      nextLessonNumber: 2,
      actions: { canStart: true, startXp: 10 },
    });
    expect(nodePopoverModel(node, 820)).toEqual({
      tone: "unit",
      title: "Drinks",
      subtitle: "Lesson 2 of 3",
      actions: [{ kind: "lesson", label: "Start +10 XP", variant: "white", disabled: false, caption: null }],
      locked: false,
    });
  });

  it("invites a unit review with its own subtitle", () => {
    const node = makeNode({ kind: "review", title: "Unit 2 review", state: "active", lessonCount: 1, actions: { canStart: true, startXp: 40 } });
    const model = nodePopoverModel(node, 820);
    expect(model.subtitle).toBe("Test what you've learned in this unit");
    expect(model.actions.map((action) => action.label)).toEqual(["Start +40 XP"]);
  });

  it("says an active node that cannot start is unavailable, with no buttons", () => {
    const model = nodePopoverModel(makeNode({ state: "active" }), 820);
    expect(model).toMatchObject({ tone: "muted", subtitle: "This lesson is currently unavailable", actions: [], locked: false });
  });

  it("offers PRACTICE and LEGENDARY on a completed skill, with the fee under LEGENDARY", () => {
    const node = makeNode({ state: "completed", crownLevel: 1, actions: { canPractice: true, canLegendary: true } });
    const model = nodePopoverModel(node, 820);
    expect(model.subtitle).toBe("Prove your proficiency with Legendary");
    expect(model.actions).toEqual([
      { kind: "practice", label: "Practice +5 XP", variant: "white", disabled: false, caption: null },
      { kind: "legendary", label: "Legendary +40 XP", variant: "gold", disabled: false, caption: "Uses 100 gems" },
    ]);
  });

  it("disables LEGENDARY when the gems do not cover the fee", () => {
    const node = makeNode({ state: "completed", actions: { canPractice: true, canLegendary: true } });
    const legendary = nodePopoverModel(node, 99).actions[1];
    expect(legendary).toMatchObject({ disabled: true, caption: "Not enough gems" });
  });

  it("shows only PRACTICE on a completed review, which has no Legendary", () => {
    const node = makeNode({ kind: "review", state: "completed", actions: { canPractice: true } });
    const model = nodePopoverModel(node, 820);
    expect(model.subtitle).toBe("You completed this level!");
    expect(model.actions.map((action) => action.kind)).toEqual(["practice"]);
  });

  it("paints a legendary node gold with PRACTICE only", () => {
    const node = makeNode({ state: "legendary", crownLevel: 2, actions: { canPractice: true } });
    expect(nodePopoverModel(node, 820)).toMatchObject({
      tone: "legendary",
      subtitle: "You completed this level!",
      actions: [{ kind: "practice", label: "Practice +5 XP" }],
    });
  });

  it("shows a locked node's title with the unlock hint and the LOCKED button", () => {
    expect(nodePopoverModel(makeNode({ title: "Family" }), 820)).toEqual({
      tone: "locked",
      title: "Family",
      subtitle: "Complete all levels above to unlock this!",
      actions: [],
      locked: true,
    });
  });

  it("calls a locked chest a treasure chest", () => {
    const chest = makeNode({ kind: "chest", title: "Chest", lessonCount: 0, chestGems: 20 });
    expect(nodePopoverModel(chest, 820)).toMatchObject({ title: "Treasure chest", locked: true });
  });
});
