import { describe, expect, it } from "vitest";
import type { LeagueRowOut, LeagueZone } from "@/lib/api/types";
import { myRow, withZoneDividers, zoneChangeMessage } from "./standings";

function row(rank: number, zone: LeagueZone, isMe = false): LeagueRowOut {
  return { rank, userId: 100 + rank, displayName: `Learner ${rank}`, avatarColor: "#1CB0F6", xp: 100 - rank, streak: 3, isMe, zone };
}

/** Rows as "rank" and dividers as "▲" / "▼", for readable expectations. */
function shape(rows: LeagueRowOut[]): string[] {
  return withZoneDividers(rows).map((entry) =>
    entry.kind === "row" ? String(entry.row.rank) : entry.zone === "promotion" ? "▲" : "▼",
  );
}

describe("withZoneDividers", () => {
  it("draws the promotion line under the last promoted rank and the demotion line above the first demoted one", () => {
    const rows = [row(1, "promotion"), row(2, "promotion"), row(3, "safe"), row(4, "safe"), row(5, "demotion")];
    expect(shape(rows)).toEqual(["1", "2", "▲", "3", "4", "▼", "5"]);
  });

  it("draws only the promotion line in a league that never demotes", () => {
    expect(shape([row(1, "promotion"), row(2, "safe"), row(3, "safe")])).toEqual(["1", "▲", "2", "3"]);
  });

  it("draws only the demotion line in the top league", () => {
    expect(shape([row(1, "safe"), row(2, "demotion")])).toEqual(["1", "▼", "2"]);
  });

  it("draws both lines between a promoted rank and a demoted one", () => {
    expect(shape([row(1, "promotion"), row(2, "demotion")])).toEqual(["1", "▲", "▼", "2"]);
  });

  it("draws no line when every rank is in one zone", () => {
    expect(shape([row(1, "promotion"), row(2, "promotion")])).toEqual(["1", "2"]);
    expect(shape([])).toEqual([]);
  });
});

describe("myRow", () => {
  it("finds the learner's own row", () => {
    expect(myRow([row(1, "promotion"), row(2, "safe", true)])?.rank).toBe(2);
  });

  it("is undefined before the learner joins", () => {
    expect(myRow([row(1, "promotion")])).toBeUndefined();
  });
});

describe("zoneChangeMessage", () => {
  it("cheers a move into the promotion zone", () => {
    expect(zoneChangeMessage("safe", "promotion")).toBe("You moved into the promotion zone!");
    expect(zoneChangeMessage("demotion", "promotion")).toBe("You moved into the promotion zone!");
  });

  it("warns about a drop into the demotion zone", () => {
    expect(zoneChangeMessage("safe", "demotion")).toBe("You moved down to the demotion zone!");
  });

  it("stays quiet otherwise", () => {
    expect(zoneChangeMessage("promotion", "promotion")).toBeNull();
    expect(zoneChangeMessage("promotion", "safe")).toBeNull();
    expect(zoneChangeMessage("demotion", "safe")).toBeNull();
    expect(zoneChangeMessage(undefined, "promotion")).toBeNull();
  });
});
