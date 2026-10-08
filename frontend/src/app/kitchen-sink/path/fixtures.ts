import type { CourseBrief, PathNodeActions, PathNodeOut, PathOut, PathUnitOut } from "@/lib/api/types";

const COURSE: CourseBrief = {
  id: 1,
  slug: "es-en",
  title: "Spanish",
  learningLanguage: "es",
  fromLanguage: "en",
  ttsLocale: "es-ES",
  flagKey: "es",
  isPublished: true,
};

const IDLE: PathNodeActions = {
  canStart: false,
  startXp: null,
  canPractice: false,
  practiceXp: 5,
  canLegendary: false,
  legendaryXp: 40,
  legendaryPriceGems: 100,
};

type NodeSeed = Omit<PathNodeOut, "actions" | "crownLevel" | "nextLessonNumber" | "chestGems"> & {
  actions?: Partial<PathNodeActions>;
};

/** A node with the fields the server derives from its state filled in the way the server fills them. */
function node({ actions, ...seed }: NodeSeed): PathNodeOut {
  const completed = seed.state === "completed" || seed.state === "legendary";
  const playable = seed.kind !== "chest";
  return {
    ...seed,
    crownLevel: playable ? (seed.state === "legendary" ? 2 : completed ? 1 : 0) : 0,
    nextLessonNumber: seed.state === "active" ? seed.lessonsCompleted + 1 : null,
    chestGems: seed.kind === "chest" ? 20 : null,
    actions: {
      ...IDLE,
      canStart: seed.state === "active" && playable,
      startXp: seed.state === "active" && playable ? (seed.kind === "review" ? 40 : 10) : null,
      canPractice: completed && playable,
      canLegendary: seed.kind === "skill" && seed.state === "completed",
      ...actions,
    },
  };
}

const UNIT_1: PathUnitOut = {
  id: 1,
  number: 1,
  section: 1,
  title: "Greet people and introduce yourself",
  description: "Say hello and introduce yourself",
  color: "green",
  state: "completed",
  hasGuidebook: true,
  nodes: [
    node({ id: 1, position: 1, kind: "skill", title: "Say hello", state: "legendary", lessonsCompleted: 3, lessonCount: 3 }),
    node({ id: 2, position: 2, kind: "skill", title: "Introduce yourself", state: "completed", lessonsCompleted: 3, lessonCount: 3 }),
    node({ id: 3, position: 3, kind: "chest", title: "Treasure chest", state: "completed", lessonsCompleted: 0, lessonCount: 0 }),
    node({ id: 4, position: 4, kind: "review", title: "Unit 1 review", state: "completed", lessonsCompleted: 1, lessonCount: 1 }),
  ],
};

const UNIT_2: PathUnitOut = {
  id: 2,
  number: 2,
  section: 1,
  title: "Order food and drinks",
  description: "Order at a café",
  color: "purple",
  state: "in_progress",
  hasGuidebook: true,
  nodes: [
    node({ id: 5, position: 1, kind: "skill", title: "Food", state: "completed", lessonsCompleted: 3, lessonCount: 3 }),
    node({ id: 6, position: 2, kind: "skill", title: "Drinks", state: "active", lessonsCompleted: 1, lessonCount: 3 }),
    node({ id: 7, position: 3, kind: "chest", title: "Treasure chest", state: "locked", lessonsCompleted: 0, lessonCount: 0 }),
    node({ id: 8, position: 4, kind: "review", title: "Unit 2 review", state: "locked", lessonsCompleted: 0, lessonCount: 1 }),
  ],
};

const UNIT_3: PathUnitOut = {
  id: 3,
  number: 3,
  section: 1,
  title: "Talk about your family",
  description: "Describe the people you love",
  color: "teal",
  state: "locked",
  hasGuidebook: true,
  nodes: [
    node({ id: 9, position: 1, kind: "skill", title: "Family", state: "locked", lessonsCompleted: 0, lessonCount: 2 }),
    node({ id: 10, position: 2, kind: "skill", title: "Describe people", state: "locked", lessonsCompleted: 0, lessonCount: 2 }),
    node({ id: 11, position: 3, kind: "review", title: "Unit 3 review", state: "locked", lessonsCompleted: 0, lessonCount: 1 }),
  ],
};

/** The seeded path: unit 1 done ("Say hello" Legendary), "Drinks" current at lesson 2 of 3, unit 3 locked. */
export const PATH: PathOut = { course: COURSE, currentNodeId: 6, units: [UNIT_1, UNIT_2, UNIT_3] };

/** One more lesson of "Drinks" done: its ring is at two thirds. */
export const PATH_DRINKS_TWO: PathOut = {
  ...PATH,
  units: [UNIT_1, withNodes(UNIT_2, { 6: { lessonsCompleted: 2 } }), UNIT_3],
};

/**
 * "Drinks" finished: it is completed with a crown, its chest can be opened and the unit review is the current
 * node.
 */
export const PATH_DRINKS_DONE: PathOut = {
  ...PATH,
  currentNodeId: 8,
  units: [
    UNIT_1,
    withNodes(UNIT_2, {
      6: { state: "completed", lessonsCompleted: 3 },
      7: { state: "available" },
      8: { state: "active" },
    }),
    UNIT_3,
  ],
};

/** The path states the previews can start from. */
export const PATH_VARIANTS = { seeded: PATH, two: PATH_DRINKS_TWO, done: PATH_DRINKS_DONE } as const;
export type PathVariant = keyof typeof PATH_VARIANTS;

/** Rebuilds some of a unit's nodes with new facts (state, lessons), re-deriving their actions and crowns. */
function withNodes(unit: PathUnitOut, changes: Record<number, Partial<NodeSeed>>): PathUnitOut {
  return {
    ...unit,
    nodes: unit.nodes.map((current) => {
      const change = changes[current.id];
      if (!change) return current;
      const { id, position, kind, title, state, lessonsCompleted, lessonCount } = current;
      return node({ id, position, kind, title, state, lessonsCompleted, lessonCount, ...change });
    }),
  };
}
