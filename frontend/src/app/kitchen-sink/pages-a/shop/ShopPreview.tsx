"use client";

import { useState } from "react";
import { useToast } from "@/components/ui";
import { ShopItemArt } from "@/features/shop/ShopItemArt";
import { PURCHASE_TOASTS } from "@/features/shop/shopItems";
import { ShopSkeleton } from "@/features/shop/ShopSkeleton";
import { ShopView } from "@/features/shop/ShopView";
import type { ShopItemCode, ShopItemOut } from "@/lib/api/types";
import { SHOP_STATES } from "../fixtures";
import { PreviewFrame, pickState } from "../PreviewFrame";

/** How long the pretend purchase takes, long enough to see the button's loading dots. */
const FAKE_REQUEST_MS = 800;

/** The shop with money to spend, with every item maxed out, and with too few gems for anything. */
export function ShopPreview({ requested }: { requested?: string }) {
  const { fixture, current } = pickState(SHOP_STATES, requested);
  const [busyCode, setBusyCode] = useState<ShopItemCode | null>(null);
  const { toast } = useToast();

  function pretendToBuy(item: ShopItemOut) {
    setBusyCode(item.code);
    setTimeout(() => {
      setBusyCode(null);
      const message = PURCHASE_TOASTS[item.code];
      if (message) toast({ tone: "reward", message, icon: <ShopItemArt code={item.code} size={28} /> });
    }, FAKE_REQUEST_MS);
  }

  return (
    <PreviewFrame title="Shop" states={Object.keys(SHOP_STATES)} current={current} skeleton={<ShopSkeleton />}>
      <ShopView shop={SHOP_STATES[fixture]} busyCode={busyCode} onBuy={pretendToBuy} />
    </PreviewFrame>
  );
}
