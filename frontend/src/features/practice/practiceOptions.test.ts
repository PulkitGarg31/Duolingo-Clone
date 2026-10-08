import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/errors";
import type { HeartsOut, PathNodeOut, PathOut, PathUnitOut } from "@/lib/api/types";
import {
  earnHeartsAvailability,
  hasCompletedLesson,
  legendarySkills,
  startErrorMessage,
  timedAvailability,
} from "./practiceOptions";

function node(id: number, overrides: Partial<PathNodeOut> = {}): PathNodeOut {
  return {
    id,
    position: id,
    kind: "skill",
    title: `Skill ${id}`,
    state: "locked",
    crownLevel: 0,
    lessonsCompleted: 0,
    lessonCount: 3,
    nextLessonNumber: null,
    chestGems: null,
    actions: {
      canStart: false,
      startXp: null,
      canPractice: false,
      practiceXp: 5,
      canLegendary: false,
      legendaryXp: 40,
      legendaryPriceGems: 100,
    },
    ...overrides,
  };
}

function unit(number: number, nodes: PathNodeOut[]): PathUnitOut {
  return {
    id: number,
    number,
    section: 1,
    title: `Unit ${number}`,
    description: "",
    color: "green",
    state: "in_progress",
    hasGuidebook: true,
    nodes,
  };
}

function path(units: PathUnitOut[]): PathOut {
  return {
    course: {
      id: 1,
      slug: "es-en",
      title: "Spanish",
      learningLanguage: "es",
      fromLanguage: "en",
      ttsLocale: "es-ES",
      flagKey: "es",
      isPublished: true,
    },
    currentNodeId: null,
    units,
  };
}

function hearts(current: number): HeartsOut {
  return { current, max: 5, nextHeartAt: null, fullAt: null, regenIntervalSeconds: 18000, refillPriceGems: 350 };
}

const FRESH = path([unit(1, [node(1, { state: "active" }), node(2)])]);
const STARTED = path([unit(1, [node(1, { state: "active", lessonsCompleted: 1 }), node(2)])]);

describe("hasCompletedLesson", () => {
  it("is false for a brand-new learner", () => {
    expect(hasCompletedLesson(FRESH)).toBe(false);
  });

  it("is true after one lesson, even inside an unfinished level", () => {
    expect(hasCompletedLesson(STARTED)).toBe(true);
  });
});

describe("legendarySkills", () => {
  it("lists finished skills in path order with their unit, leaving out chests, reviews and unfinished skills", () => {
    const course = path([
      unit(1, [
        node(1, { state: "legendary", lessonsCompleted: 3 }),
        node(2, { state: "completed", lessonsCompleted: 3 }),
        node(3, { kind: "chest", state: "completed" }),
        node(4, { kind: "review", state: "completed", lessonsCompleted: 1 }),
      ]),
      unit(2, [node(5, { state: "completed", lessonsCompleted: 3 }), node(6, { state: "active", lessonsCompleted: 1 })]),
    ]);
    expect(legendarySkills(course).map(({ node: skill, unit: owner }) => [skill.id, owner.number])).toEqual([
      [1, 1],
      [2, 1],
      [5, 2],
    ]);
  });
});

describe("earnHeartsAvailability", () => {
  it("needs a finished lesson first", () => {
    expect(earnHeartsAvailability(FRESH, hearts(3))).toEqual({
      enabled: false,
      note: "Complete a lesson to unlock practice",
    });
  });

  it("is pointless with full hearts", () => {
    expect(earnHeartsAvailability(STARTED, hearts(5))).toEqual({ enabled: false, note: "You have full hearts" });
  });

  it("earns a heart otherwise, even from zero", () => {
    expect(earnHeartsAvailability(STARTED, hearts(0))).toEqual({ enabled: true, note: "+1 heart" });
  });
});

describe("timedAvailability", () => {
  it("needs a finished lesson first", () => {
    expect(timedAvailability(FRESH)).toEqual({ enabled: false, note: "Complete a lesson to unlock practice" });
    expect(timedAvailability(STARTED)).toEqual({ enabled: true, note: "Race the clock to earn XP" });
  });
});

describe("startErrorMessage", () => {
  const error = (code: ApiError["code"], status: number) =>
    new ApiError({ status, code, title: code, detail: "The server's own explanation." });

  it.each([
    ["NOTHING_TO_PRACTICE", 409, "Complete a lesson to unlock practice"],
    ["INSUFFICIENT_GEMS", 409, "Not enough gems"],
    ["ALREADY_LEGENDARY", 409, "This lesson is currently unavailable"],
    ["NODE_LOCKED", 409, "This lesson is currently unavailable"],
    ["NODE_NOT_PLAYABLE", 409, "This lesson is currently unavailable"],
    ["VALIDATION_ERROR", 422, "The server's own explanation."],
  ] as const)("explains %s", (code, status, expected) => {
    expect(startErrorMessage(error(code, status))).toBe(expected);
  });

  it("leaves unreachable-server failures and server bugs to the app-wide toast", () => {
    expect(startErrorMessage(error("NETWORK_ERROR", 0))).toBeNull();
    expect(startErrorMessage(error("INTERNAL_ERROR", 500))).toBeNull();
  });
});
