import type { PathNodeActions, PathNodeOut } from "@/lib/api/types";

/** Actions of a node nothing can be done with; tests override the flags they need. */
const NO_ACTIONS: PathNodeActions = {
  canStart: false,
  startXp: null,
  canPractice: false,
  practiceXp: 5,
  canLegendary: false,
  legendaryXp: 40,
  legendaryPriceGems: 100,
};

/** A path node for unit tests: a locked skill unless `overrides` say otherwise. */
export function makeNode(overrides: Partial<Omit<PathNodeOut, "actions">> & { actions?: Partial<PathNodeActions> } = {}): PathNodeOut {
  const { actions, ...rest } = overrides;
  return {
    id: 6,
    position: 2,
    kind: "skill",
    title: "Drinks",
    state: "locked",
    crownLevel: 0,
    lessonsCompleted: 0,
    lessonCount: 3,
    nextLessonNumber: null,
    chestGems: null,
    ...rest,
    actions: { ...NO_ACTIONS, ...actions },
  };
}
