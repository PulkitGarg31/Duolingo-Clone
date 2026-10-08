import { describe, expect, it } from "vitest";
import { monthEndsAt, monthName, questsStatus } from "./questCopy";

describe("questsStatus", () => {
  it("is empty before the first quest is done", () => {
    expect(questsStatus(0, 3)).toBeNull();
  });

  it("counts finished quests", () => {
    expect(questsStatus(1, 3)).toBe("You've completed 1 out of 3 quests today.");
    expect(questsStatus(2, 3)).toBe("You've completed 2 out of 3 quests today.");
  });

  it("celebrates a full set", () => {
    expect(questsStatus(3, 3)).toBe("All Daily Quests complete!");
  });
});

describe("monthEndsAt", () => {
  // Kolkata's midnight is 18:30 UTC the day before.
  it("adds the days left after today to the next local midnight", () => {
    expect(monthEndsAt("2026-10-09", "2026-10-09T18:30:00.000Z")).toBe("2026-10-31T18:30:00.000Z");
  });

  it("is the next midnight on the month's last day", () => {
    expect(monthEndsAt("2026-10-31", "2026-10-31T18:30:00.000Z")).toBe("2026-10-31T18:30:00.000Z");
  });

  it("knows how long each month is", () => {
    expect(monthEndsAt("2028-02-10", "2028-02-11T00:00:00.000Z")).toBe("2028-03-01T00:00:00.000Z");
    expect(monthEndsAt("2026-02-10", "2026-02-11T00:00:00.000Z")).toBe("2026-03-01T00:00:00.000Z");
  });
});

describe("monthName", () => {
  it("names the month of a learner-local date, whatever the device's time zone", () => {
    expect(monthName("2026-10-01")).toBe("October");
    expect(monthName("2026-12-31")).toBe("December");
  });
});
