import { describe, expect, it } from "vitest";
import { activeNavKey, NAV_ITEMS } from "./navItems";

describe("NAV_ITEMS", () => {
  it("lists the six destinations in Duolingo's order", () => {
    expect(NAV_ITEMS.map((item) => item.label)).toEqual(["Learn", "Practice", "Leaderboards", "Quests", "Shop", "Profile"]);
  });
});

describe("activeNavKey", () => {
  it("follows the route prefix", () => {
    expect(activeNavKey("/learn")).toBe("learn");
    expect(activeNavKey("/profile/24")).toBe("profile");
    expect(activeNavKey("/leaderboard")).toBe("leaderboard");
  });

  it("keeps Learn active on the guidebook, which belongs to the path", () => {
    expect(activeNavKey("/guidebook/2")).toBe("learn");
  });

  it("highlights nothing on pages outside the menu", () => {
    expect(activeNavKey("/settings")).toBeNull();
    expect(activeNavKey("/learning")).toBeNull();
  });
});
