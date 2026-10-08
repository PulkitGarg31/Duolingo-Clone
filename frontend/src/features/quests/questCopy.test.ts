import { describe, expect, it } from "vitest";
import { dailyGoalMessage, monthName, questsStatus } from "./questCopy";

describe("dailyGoalMessage", () => {
  it("says how much XP is still missing", () => {
    expect(dailyGoalMessage({ goalXp: 20, earnedXp: 12, met: false })).toBe("Earn 8 more XP to reach your daily goal");
    expect(dailyGoalMessage({ goalXp: 50, earnedXp: 0, met: false })).toBe("Earn 50 more XP to reach your daily goal");
  });

  it("celebrates a met goal", () => {
    expect(dailyGoalMessage({ goalXp: 20, earnedXp: 35, met: true })).toBe("Daily goal complete! Nice work!");
  });
});

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

describe("monthName", () => {
  it("names the month of a learner-local date, whatever the device's time zone", () => {
    expect(monthName("2026-10-01")).toBe("October");
    expect(monthName("2026-12-31")).toBe("December");
  });
});
