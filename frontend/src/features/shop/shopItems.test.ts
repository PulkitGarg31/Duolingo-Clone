import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/errors";
import type { ShopItemOut } from "@/lib/api/types";
import { boostMinutesLeft, groupBySection, itemMetaLine, purchaseFailure, shopActionState } from "./shopItems";

const MINUTE = 60_000;

function item(overrides: Partial<ShopItemOut>): ShopItemOut {
  return {
    code: "heart_refill",
    kind: "heart_refill",
    section: "hearts",
    name: "Refill Hearts",
    description: "Get full hearts so you can worry less about making mistakes in a lesson",
    priceGems: 350,
    durationMinutes: null,
    owned: null,
    maxOwned: null,
    activeUntil: null,
    available: true,
    unavailableReason: null,
    ...overrides,
  };
}

function apiError(code: ApiError["code"], status = 409): ApiError {
  return new ApiError({ status, code, title: code, detail: "The server's own explanation." });
}

describe("shopActionState", () => {
  it("offers the price when the item can be bought", () => {
    expect(shopActionState(item({}))).toEqual({ kind: "buy", price: 350 });
  });

  it.each([
    ["HEARTS_ALREADY_FULL", { kind: "full" }],
    ["MAX_FREEZES_EQUIPPED", { kind: "equipped" }],
    ["INSUFFICIENT_GEMS", { kind: "short", price: 350 }],
    ["ITEM_UNAVAILABLE", { kind: "soon" }],
  ] as const)("turns %s into %j", (reason, expected) => {
    expect(shopActionState(item({ available: false, unavailableReason: reason }))).toEqual(expected);
  });
});

describe("groupBySection", () => {
  it("keeps the catalogue order inside each section and the sections in order of appearance", () => {
    const items = [
      item({ code: "heart_refill" }),
      item({ code: "unlimited_hearts", kind: "super" }),
      item({ code: "streak_freeze", kind: "streak_freeze", section: "power_ups" }),
      item({ code: "xp_boost_15", kind: "xp_boost", section: "power_ups" }),
    ];
    expect(groupBySection(items).map(({ title, items: inSection }) => [title, inSection.map((entry) => entry.code)])).toEqual([
      ["Hearts", ["heart_refill", "unlimited_hearts"]],
      ["Power-Ups", ["streak_freeze", "xp_boost_15"]],
    ]);
  });
});

describe("boostMinutesLeft", () => {
  it("rounds up, so the last minute still reads 1", () => {
    expect(boostMinutesLeft(14 * MINUTE + 1_000)).toBe(15);
    expect(boostMinutesLeft(1_000)).toBe(1);
  });

  it("is 0 once the boost has run out", () => {
    expect(boostMinutesLeft(0)).toBe(0);
  });
});

describe("itemMetaLine", () => {
  const boost = item({ code: "xp_boost_15", kind: "xp_boost", activeUntil: "2026-10-08T12:12:30Z" });

  it("counts equipped Streak Freezes", () => {
    const freeze = item({ code: "streak_freeze", kind: "streak_freeze", section: "power_ups", owned: 1, maxOwned: 2 });
    expect(itemMetaLine(freeze, 0)).toEqual({ text: "1 / 2 equipped", tone: "gem" });
  });

  it("shows the time left on a running XP Boost", () => {
    expect(itemMetaLine(boost, 12.5 * MINUTE)).toEqual({ text: "Active · 13 min left", tone: "boost" });
  });

  it("has nothing to say about a boost that ran out or an item without a count", () => {
    expect(itemMetaLine(boost, 0)).toBeNull();
    expect(itemMetaLine(item({}), 0)).toBeNull();
  });
});

describe("purchaseFailure", () => {
  it("explains a short balance and refreshes the shop", () => {
    expect(purchaseFailure(apiError("INSUFFICIENT_GEMS"))).toEqual({ message: "Not enough gems", refreshShop: true });
  });

  it.each(["HEARTS_ALREADY_FULL", "MAX_FREEZES_EQUIPPED", "ITEM_UNAVAILABLE"] as const)(
    "quietly refreshes the shop after %s, whose button then shows why",
    (code) => {
      expect(purchaseFailure(apiError(code))).toEqual({ message: null, refreshShop: true });
    },
  );

  it("leaves unreachable-server failures and server bugs to the app-wide toast", () => {
    expect(purchaseFailure(apiError("NETWORK_ERROR", 0))).toEqual({ message: null, refreshShop: false });
    expect(purchaseFailure(apiError("INTERNAL_ERROR", 500))).toEqual({ message: null, refreshShop: false });
  });

  it("passes on the server's explanation of anything else", () => {
    expect(purchaseFailure(apiError("VALIDATION_ERROR", 422))).toEqual({
      message: "The server's own explanation.",
      refreshShop: false,
    });
  });
});
