import { domainErrorMessage } from "@/features/shell/domainErrorMessage";
import type { ApiError, ApiErrorCode } from "@/lib/api/errors";
import type { ShopItemCode, ShopItemOut, ShopSection } from "@/lib/api/types";

const MINUTE_MS = 60_000;

/** What an item's button offers, from the availability the server computed for this learner. */
export type ShopActionState =
  | { kind: "buy"; price: number }
  /** Priced, but the learner cannot afford it: disabled, with "Not enough gems" under it. */
  | { kind: "short"; price: number }
  | { kind: "full" }
  | { kind: "equipped" }
  | { kind: "soon" };

export function shopActionState(item: ShopItemOut): ShopActionState {
  if (item.available) return { kind: "buy", price: item.priceGems };
  switch (item.unavailableReason) {
    case "HEARTS_ALREADY_FULL":
      return { kind: "full" };
    case "MAX_FREEZES_EQUIPPED":
      return { kind: "equipped" };
    case "INSUFFICIENT_GEMS":
      return { kind: "short", price: item.priceGems };
    default:
      return { kind: "soon" };
  }
}

const SECTION_TITLES: Record<ShopSection, string> = { hearts: "Hearts", power_ups: "Power-Ups" };

export interface ShopSectionGroup {
  section: ShopSection;
  title: string;
  items: ShopItemOut[];
}

/** The catalogue split into its sections, keeping the server's order. */
export function groupBySection(items: readonly ShopItemOut[]): ShopSectionGroup[] {
  const groups = new Map<ShopSection, ShopSectionGroup>();
  for (const item of items) {
    const group = groups.get(item.section) ?? { section: item.section, title: SECTION_TITLES[item.section], items: [] };
    group.items.push(item);
    groups.set(item.section, group);
  }
  return [...groups.values()];
}

/** Whole minutes left on a boost, rounded up so the last minute still reads "1 min left". */
export function boostMinutesLeft(msLeft: number): number {
  return Math.max(0, Math.ceil(msLeft / MINUTE_MS));
}

export interface MetaLine {
  text: string;
  /** `gem` for counts (macaw), `boost` for a running XP Boost (beetle). */
  tone: "gem" | "boost";
}

/**
 * The small line under an item's description: the Streak Freezes equipped, or the time left on a running XP
 * Boost (`boostMsLeft`, counted down against the item's `activeUntil`).
 */
export function itemMetaLine(item: ShopItemOut, boostMsLeft: number): MetaLine | null {
  if (item.kind === "streak_freeze" && item.owned !== null && item.maxOwned !== null) {
    return { text: `${item.owned} / ${item.maxOwned} equipped`, tone: "gem" };
  }
  const minutes = item.kind === "xp_boost" ? boostMinutesLeft(boostMsLeft) : 0;
  return minutes > 0 ? { text: `Active · ${minutes} min left`, tone: "boost" } : null;
}

/** The confirmation toast for each item that can be bought. */
export const PURCHASE_TOASTS: Partial<Record<ShopItemCode, string>> = {
  heart_refill: "Hearts refilled!",
  streak_freeze: "Streak Freeze equipped",
  xp_boost_15: "XP Boost activated! Double XP for 15 minutes",
};

/** Codes that mean the shop on screen is out of date: refetch it and let the item's button explain. */
const STALE_SHOP_CODES = new Set<ApiErrorCode>([
  "INSUFFICIENT_GEMS",
  "HEARTS_ALREADY_FULL",
  "MAX_FREEZES_EQUIPPED",
  "ITEM_UNAVAILABLE",
]);

export interface PurchaseFailure {
  /** A toast of its own, or null when the button explains it or the app-wide toast already covers it. */
  message: string | null;
  refreshShop: boolean;
}

/**
 * What to do after a purchase fails. A short balance gets its own toast; the other stale-shop codes refresh the
 * shop quietly, so the button turns into FULL, EQUIPPED or COMING SOON. An unreachable server or a server bug
 * is toasted app-wide, and the shop stays as it is.
 */
export function purchaseFailure(error: ApiError): PurchaseFailure {
  const refreshShop = STALE_SHOP_CODES.has(error.code);
  const explainedByButton = refreshShop && error.code !== "INSUFFICIENT_GEMS";
  return {
    message: explainedByButton ? null : domainErrorMessage(error, { INSUFFICIENT_GEMS: "Not enough gems" }),
    refreshShop,
  };
}
