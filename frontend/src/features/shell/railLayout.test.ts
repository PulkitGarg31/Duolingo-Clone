import { describe, expect, it } from "vitest";
import { railLayoutFor } from "./railLayout";

describe("railLayoutFor", () => {
  it("stacks stats, league, quests, the Super promo and the footer on /learn", () => {
    expect(railLayoutFor("/learn")).toEqual({
      width: 368,
      blocks: ["stats", "league", "quests", "super", "footer"],
    });
  });

  it("follows each page's stack", () => {
    expect(railLayoutFor("/leaderboard").blocks).toEqual(["stats", "quests", "super", "footer"]);
    expect(railLayoutFor("/quests").blocks).toEqual(["stats", "league", "super", "footer"]);
    expect(railLayoutFor("/shop").blocks).toEqual(["stats", "league", "quests", "footer"]);
    expect(railLayoutFor("/profile").blocks).toEqual(["stats", "friends", "quests", "footer"]);
    expect(railLayoutFor("/practice").blocks).toEqual(["stats", "quests", "footer"]);
  });

  it("matches nested routes by their first segment", () => {
    expect(railLayoutFor("/profile/24").blocks).toEqual(["stats", "friends", "quests", "footer"]);
    expect(railLayoutFor("/guidebook/2").blocks).toEqual(["stats", "quests", "footer"]);
  });

  it("does not match a route that only shares a prefix", () => {
    expect(railLayoutFor("/learning").blocks).toEqual(["stats", "quests", "footer"]);
  });

  it("gives settings a wider rail holding its section menu instead of the stats", () => {
    expect(railLayoutFor("/settings")).toEqual({ width: 380, blocks: ["settingsNav", "footer"] });
  });

  it("closes the stack with the guest card for the demo learner", () => {
    expect(railLayoutFor("/learn", { guest: true }).blocks).toEqual(["stats", "league", "quests", "super", "guest", "footer"]);
    expect(railLayoutFor("/profile/24", { guest: true }).blocks).toEqual(["stats", "friends", "quests", "guest", "footer"]);
    expect(railLayoutFor("/learn", { guest: false }).blocks).not.toContain("guest");
  });

  it("keeps the settings menu alone in the rail, even for the demo learner", () => {
    expect(railLayoutFor("/settings", { guest: true }).blocks).toEqual(["settingsNav", "footer"]);
  });

  it("falls back to stats, quests and the footer elsewhere", () => {
    expect(railLayoutFor("/super").blocks).toEqual(["stats", "quests", "footer"]);
  });
});
