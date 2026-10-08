import { describe, expect, it } from "vitest";
import type { AchievementUnlockOut } from "@/lib/api/types";
import { APP_NAME } from "@/lib/constants";
import { ACCOLADES, achievementCopy, questRewardCopy, streakBody, timedResultCopy } from "./copy";

const OCTOBER = Array.from({ length: 31 }, (_, index) => `2026-10-${String(index + 1).padStart(2, "0")}`);

describe("streakBody", () => {
  const EARLY = [
    "Practicing daily grows your streak, but skipping a day resets it!",
    "Practice each day so your streak won't reset!",
    "But your streak will reset if you don't practice tomorrow. Watch out!",
  ];
  const LONG = [
    "You're making great progress!",
    "You're on fire! Keep the flame lit every day!",
    "You're crushing your learning goals. Keep it up!",
    "What a streak! Keep it going every day.",
    "Keep learning tomorrow to make it 11!",
  ];

  it("congratulates a milestone by its length", () => {
    expect(streakBody(14, true, "2026-10-08")).toBe(`Congrats on using ${APP_NAME} for 14 days in a row`);
  });

  it("counts down to five and seven days", () => {
    expect(streakBody(4, false, "2026-10-08")).toBe("You're one day away from a 5 day streak");
    expect(streakBody(5, false, "2026-10-08")).toBe("You're two days away from a 7 day streak");
    expect(streakBody(6, false, "2026-10-08")).toBe("You're one day away from a 7 day streak");
  });

  it("reminds a new streak that a missed day resets it", () => {
    for (const after of [1, 2, 3]) expect(EARLY).toContain(streakBody(after, false, "2026-10-08"));
  });

  it("cheers a long streak on", () => {
    expect(LONG).toContain(streakBody(10, false, "2026-10-08"));
  });

  it("keeps the same message all day", () => {
    expect(streakBody(2, false, "2026-10-08")).toBe(streakBody(2, false, "2026-10-08"));
  });

  it("varies the message from day to day", () => {
    expect(new Set(OCTOBER.map((day) => streakBody(2, false, day)))).toEqual(new Set(EARLY));
    expect(new Set(OCTOBER.map((day) => streakBody(10, false, day)))).toEqual(new Set(LONG));
  });
});

describe("ACCOLADES", () => {
  it("rounds a quick lesson up to the next whole minute", () => {
    expect(ACCOLADES.fast(98)).toBe("You completed this lesson in under 2 minutes");
    expect(ACCOLADES.fast(59)).toBe("You completed this lesson in under 1 minute");
    expect(ACCOLADES.fast(60)).toBe("You completed this lesson in under 2 minutes");
  });

  it("rounds a long lesson down to the last whole minute it passed", () => {
    expect(ACCOLADES.slow(425)).toBe("This lesson took over 7 minutes. Way to power through!");
    expect(ACCOLADES.slow(480)).toBe("This lesson took over 7 minutes. Way to power through!");
    expect(ACCOLADES.slow(481)).toBe("This lesson took over 8 minutes. Way to power through!");
  });

  it("writes XP without a thousands separator", () => {
    expect(ACCOLADES.xp(1200)).toBe("You earned 1200 XP in this lesson");
  });
});

describe("questRewardCopy", () => {
  const dailyGoal = { code: "daily_goal", title: "Earn 20 XP", rewardGems: 10 };
  const lessons = { code: "lessons_2", title: "Complete 2 lessons", rewardGems: 10 };
  const perfect = { code: "perfect_3", title: "Complete 3 perfect lessons", rewardGems: 15 };

  it("adds up the gems of every quest completed", () => {
    expect(questRewardCopy([dailyGoal, perfect]).title).toBe("You earned 25 gems!");
  });

  it("praises the daily goal first", () => {
    expect(questRewardCopy([dailyGoal, lessons]).body).toBe("Nice job reaching your daily goal!");
  });

  it("names a single quest", () => {
    expect(questRewardCopy([lessons]).body).toBe("You completed the “Complete 2 lessons” quest!");
  });

  it("counts several quests", () => {
    expect(questRewardCopy([lessons, perfect]).body).toBe("You completed 2 quests!");
  });
});

describe("achievementCopy", () => {
  const unlock = (code: AchievementUnlockOut["code"], threshold: number, description = ""): AchievementUnlockOut => ({
    code,
    name: code.charAt(0).toUpperCase() + code.slice(1),
    level: 1,
    threshold,
    description,
    color: "#FF9600",
  });

  it("titles the modal with the achievement's name", () => {
    expect(achievementCopy(unlock("wildfire", 14)).title).toBe("Wildfire unlocked!");
  });

  it.each([
    ["wildfire", 14, "You reached a 14 day streak"],
    ["sage", 1000, "You earned 1000 XP"],
    ["scholar", 50, "You learned 50 new words in a single course"],
    ["sharpshooter", 1, "You completed 1 lesson with no mistakes"],
    ["sharpshooter", 5, "You completed 5 lessons with no mistakes"],
    ["champion", 1, "You unlocked Leaderboards!"],
  ] as const)("describes %s at threshold %i", (code, threshold, body) => {
    expect(achievementCopy(unlock(code, threshold)).body).toBe(body);
  });

  it("falls back to the description for the league trophies", () => {
    expect(achievementCopy(unlock("winner", 1, "Finish #1 in the leaderboard")).body).toBe(
      "Finish #1 in the leaderboard",
    );
  });
});

describe("timedResultCopy", () => {
  it("announces the XP won and the correct answers", () => {
    expect(timedResultCopy(12, 12)).toEqual({
      title: "You won 12 XP!",
      body: "You answered 12 questions correctly. Great job!",
    });
  });

  it("uses the singular for one question", () => {
    expect(timedResultCopy(1, 1).body).toBe("You answered 1 question correctly. Great job!");
  });

  it("calls time with no correct answer", () => {
    expect(timedResultCopy(0, 0)).toEqual({ title: "Time's up!", body: "Practice a little more and try again!" });
  });
});
