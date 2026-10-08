import { describe, expect, it } from "vitest";
import type { SettingsOut } from "@/lib/api/types";
import { settingsPatch } from "./settingsPatch";

const saved: SettingsOut = {
  dailyGoalXp: 20,
  theme: "system",
  soundEffects: true,
  animations: true,
  motivationalMessages: true,
  listeningExercises: true,
  timezone: "Asia/Kolkata",
};

describe("settingsPatch", () => {
  it("is empty when nothing was edited", () => {
    expect(settingsPatch(saved, {})).toEqual({});
  });

  it("keeps only the fields that differ from the saved settings", () => {
    expect(settingsPatch(saved, { dailyGoalXp: 50, soundEffects: true, theme: "dark" })).toEqual({
      dailyGoalXp: 50,
      theme: "dark",
    });
  });

  it("drops an edit that was changed back to the saved value", () => {
    expect(settingsPatch(saved, { animations: true, listeningExercises: true })).toEqual({});
  });

  it("includes a new time zone", () => {
    expect(settingsPatch(saved, { timezone: "Europe/Madrid" })).toEqual({ timezone: "Europe/Madrid" });
  });
});
