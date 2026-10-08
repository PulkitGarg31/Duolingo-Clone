import { describe, expect, it } from "vitest";
import type { MeLeague } from "@/lib/api/types";
import { leagueStatusLine } from "./leagueStatus";

/** Silver, 30 members: the top 15 go up, the bottom 7 (ranks 24–30) go down. */
function silver(overrides: Partial<MeLeague>): MeLeague {
  return {
    unlocked: true,
    lessonsToUnlock: 0,
    tier: 2,
    name: "Silver",
    color: "#C9D6E2",
    joinedThisWeek: true,
    rank: 17,
    weeklyXp: 42,
    zone: "safe",
    xpToPassNext: 9,
    cohortSize: 30,
    promoteCount: 15,
    demoteCount: 7,
    weekEndsAt: "2026-10-12T00:00:00Z",
    ...overrides,
  };
}

describe("leagueStatusLine", () => {
  it("cheers on the top 3 first", () => {
    expect(leagueStatusLine(silver({ rank: 2, zone: "promotion" }))).toEqual({
      text: "Keep it up to stay in the top 3!",
      tone: "top",
    });
  });

  it("names the promotion and demotion zones", () => {
    expect(leagueStatusLine(silver({ rank: 9, zone: "promotion" }))).toEqual({
      text: "You're in the promotion zone!",
      tone: "up",
    });
    expect(leagueStatusLine(silver({ rank: 26, zone: "demotion" }))).toEqual({
      text: "You're in the demotion zone!",
      tone: "down",
    });
  });

  it("warns when the demotion zone is up to 3 ranks away", () => {
    expect(leagueStatusLine(silver({ rank: 21 }))).toEqual({ text: "3 ranks away from the demotion zone!", tone: "down" });
    expect(leagueStatusLine(silver({ rank: 23 }))).toEqual({ text: "1 rank away from the demotion zone!", tone: "down" });
  });

  it("otherwise says how much XP passes the learner above", () => {
    expect(leagueStatusLine(silver({ rank: 17, xpToPassNext: 9 }))).toEqual({
      text: "You're only 9 XP away from moving up!",
      tone: "neutral",
    });
  });

  it("never warns about demotion in a league without a demotion zone", () => {
    const bronze = silver({ tier: 1, name: "Bronze", demoteCount: 0, promoteCount: 20, rank: 29, xpToPassNext: 3 });
    expect(leagueStatusLine(bronze)?.tone).toBe("neutral");
  });

  it("has nothing to say before the learner joins this week", () => {
    expect(leagueStatusLine(silver({ joinedThisWeek: false, rank: null, zone: null, xpToPassNext: null }))).toBeNull();
  });
});
