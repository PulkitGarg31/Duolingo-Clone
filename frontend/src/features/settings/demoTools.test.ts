import { describe, expect, it } from "vitest";
import type { ClockChangeOut, LeagueResultOut, SyncEffectsOut } from "@/lib/api/types";
import {
  clockToast,
  formatOffset,
  formatSimulatedTime,
  learnerPatch,
  learnerToast,
  mergeEffects,
  nextDayCallsToSkipADay,
  resetCopy,
  resetToast,
  weekResultToShow,
} from "./demoTools";

const DAY = 86_400;
const HOUR = 3_600;

function effects(overrides: Partial<SyncEffectsOut> = {}, streak: Partial<SyncEffectsOut["streak"]> = {}): SyncEffectsOut {
  return {
    heartsGained: 0,
    leagueResults: [],
    sessionsExpired: 0,
    ...overrides,
    streak: { before: 13, after: 13, freezesUsed: 0, lost: false, ...streak },
  };
}

function change(localDate: string, sync: SyncEffectsOut): ClockChangeOut {
  return {
    clock: {
      realNow: "2026-10-08T12:00:00Z",
      offsetSeconds: DAY,
      now: "2026-10-09T12:00:00Z",
      timezone: "Asia/Kolkata",
      localNow: `${localDate}T17:30:00+05:30`,
      localDate,
      leagueWeekStart: "2026-10-05",
      leagueWeekEndsAt: "2026-10-12T00:00:00Z",
    },
    effects: sync,
  };
}

const todayDone = { localDate: "2026-10-08", extendedToday: true };
const todayOpen = { localDate: "2026-10-08", extendedToday: false };

describe("formatOffset", () => {
  it.each([
    [0, "Real time"],
    [59, "Real time"],
    [5 * 60, "Real time + 5 min"],
    [HOUR, "Real time + 1 h"],
    [DAY + 5 * HOUR, "Real time + 1 day 5 h"],
    [2 * DAY, "Real time + 2 days"],
    [2 * DAY + 3 * HOUR + 120, "Real time + 2 days 3 h"],
  ])("%i seconds reads %s", (seconds, expected) => {
    expect(formatOffset(seconds)).toBe(expected);
  });
});

describe("formatSimulatedTime", () => {
  it("shows the learner's local weekday, date and time", () => {
    expect(formatSimulatedTime(Date.parse("2026-10-08T14:12:00Z"), "Asia/Kolkata")).toBe("Thu, Oct 8 · 7:42 PM");
  });

  it("rolls over to the next local day", () => {
    expect(formatSimulatedTime(Date.parse("2026-10-08T18:30:05Z"), "Asia/Kolkata")).toBe("Fri, Oct 9 · 12:00 AM");
  });
});

describe("clockToast", () => {
  it("names the jump alone when nothing else changed", () => {
    expect(clockToast("hour", change("2026-10-08", effects()), todayDone)).toBe("Jumped ahead 1 hour.");
  });

  it("adds regenerated hearts", () => {
    expect(clockToast("fiveHours", change("2026-10-08", effects({ heartsGained: 1 })), todayDone)).toBe(
      "Jumped ahead 5 hours. +1 heart regenerated.",
    );
    expect(clockToast("nextWeek", change("2026-10-12", effects({ heartsGained: 2 }, { after: 0, lost: true })), todayDone)).toBe(
      "Jumped to next week. +2 hearts regenerated. Your 13 day streak was lost. Start a new one today!",
    );
  });

  it("nudges for a lesson when the new day has none yet", () => {
    expect(clockToast("nextDay", change("2026-10-09", effects()), todayDone)).toBe(
      "Jumped to tomorrow. Do a lesson to keep your 13 day streak!",
    );
  });

  it("keeps quiet about the streak when today's lesson is already done", () => {
    expect(clockToast("fiveHours", change("2026-10-08", effects()), todayDone)).toBe("Jumped ahead 5 hours.");
    expect(clockToast("fiveHours", change("2026-10-08", effects()), todayOpen)).toBe(
      "Jumped ahead 5 hours. Do a lesson to keep your 13 day streak!",
    );
  });

  it("reports a freeze that saved the streak", () => {
    expect(clockToast("skipDay", change("2026-10-10", effects({}, { after: 14, before: 14, freezesUsed: 1 })), todayDone)).toBe(
      "Skipped a day. A Streak Freeze kept your 14 day streak alive.",
    );
  });

  it("reports a lost streak instead of the freeze when both happened", () => {
    expect(clockToast("skipDay", change("2026-10-10", effects({}, { after: 0, freezesUsed: 1, lost: true })), todayOpen)).toBe(
      "Skipped a day. Your 13 day streak was lost. Start a new one today!",
    );
  });

  it("has no streak line without a streak", () => {
    expect(clockToast("nextDay", change("2026-10-09", effects({}, { before: 0, after: 0 })), todayOpen)).toBe(
      "Jumped to tomorrow.",
    );
  });
});

describe("SKIP A DAY", () => {
  it("misses today when it has no lesson yet, otherwise tomorrow", () => {
    expect(nextDayCallsToSkipADay(false)).toBe(1);
    expect(nextDayCallsToSkipADay(true)).toBe(2);
  });

  it("merges the effects of two jumps into one report", () => {
    const first = effects({ heartsGained: 1 });
    const second = effects({ heartsGained: 1, sessionsExpired: 1 }, { before: 13, after: 13, freezesUsed: 1 });
    expect(mergeEffects(first, second)).toEqual({
      heartsGained: 2,
      leagueResults: [],
      sessionsExpired: 1,
      streak: { before: 13, after: 13, freezesUsed: 1, lost: false },
    });
  });
});

describe("learner shortcuts", () => {
  const me = { gems: 820, hearts: { current: 4, max: 5 } };

  it("maps each button to its patch", () => {
    expect(learnerPatch("drainHearts", me)).toEqual({ hearts: 0 });
    expect(learnerPatch("refillHearts", me)).toEqual({ hearts: 5 });
    expect(learnerPatch("addGems", me)).toEqual({ gems: 1320 });
  });

  it("confirms the result", () => {
    expect(learnerToast("drainHearts", { ...me, hearts: { current: 0, max: 5 } })).toBe("Hearts set to 0.");
    expect(learnerToast("refillHearts", { ...me, hearts: { current: 5, max: 5 } })).toBe("Hearts set to 5.");
    expect(learnerToast("addGems", { ...me, gems: 1320 })).toBe("+500 gems added.");
  });
});

describe("weekResultToShow", () => {
  function result(membershipId: number): LeagueResultOut {
    const silver = { tier: 2, name: "Silver", color: "#C9D6E2" };
    return { membershipId, weekStart: "2026-10-05", league: silver, finalRank: 18, finalXp: 57, outcome: "stayed", newLeague: silver, seen: false };
  }

  it("shows the result of a week a jump just finished", () => {
    expect(weekResultToShow(result(31), [31])).toEqual(result(31));
  });

  it("leaves any other unseen result to the path", () => {
    expect(weekResultToShow(result(14), [31])).toBeNull();
    expect(weekResultToShow(result(14), [])).toBeNull();
  });

  it("shows nothing once the result is acknowledged", () => {
    expect(weekResultToShow(null, [31])).toBeNull();
  });
});

describe("reset copy", () => {
  it("names the demo reset for the demo learner and a progress reset for an account", () => {
    expect(resetCopy(true).button).toBe("Reset demo data");
    expect(resetCopy(false).button).toBe("Reset my progress");
    expect(resetCopy(false).description).toContain("Unit 1");
    expect(resetToast(true)).toBe("Demo data reset to the sample learner.");
    expect(resetToast(false)).toContain("Your progress was reset");
  });
});
