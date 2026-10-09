"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useToast } from "@/components/ui";
import { useSingleFlight } from "@/features/shell/singleFlight";
import type { ShopItemCode, ShopItemOut } from "@/lib/api/types";
import { newIdempotencyKey } from "@/lib/idempotency";
import { useShop } from "@/lib/queries/hooks";
import { qk } from "@/lib/queries/keys";
import { usePurchase } from "@/lib/queries/mutations";
import { ShopItemArt } from "./ShopItemArt";
import { PURCHASE_TOASTS, purchaseFailure } from "./shopItems";
import { ShopSkeleton } from "./ShopSkeleton";
import { ShopView } from "./ShopView";

/**
 * /shop. A purchase is one click with one idempotency key, made here so a retried request can never charge
 * twice, and one purchase runs at a time, so a double click buys once. The bought item's button keeps loading
 * until the refreshed shop arrives, so it turns straight into FULL or EQUIPPED instead of flashing its price
 * again. A failed first load goes to the route's error boundary.
 */
export function ShopPage() {
  const shop = useShop();
  const purchase = usePurchase();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const once = useSingleFlight();

  function buy(item: ShopItemOut) {
    once((done) =>
      purchase.mutate(
        { itemCode: item.code, idempotencyKey: newIdempotencyKey() },
        {
          onSuccess: ({ itemCode }) => {
            const message = PURCHASE_TOASTS[itemCode];
            if (message) toast({ tone: "reward", message, icon: <ShopItemArt code={itemCode} size={28} /> });
          },
          onError: (error) => {
            const { message, refreshShop } = purchaseFailure(error);
            if (refreshShop) void queryClient.invalidateQueries({ queryKey: qk.shop });
            if (message) toast({ tone: "warning", message });
          },
          onSettled: done,
        },
      ),
    );
  }

  const refreshAfterBoost = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: qk.shop });
    void queryClient.invalidateQueries({ queryKey: qk.me, exact: true });
  }, [queryClient]);

  let busyCode: ShopItemCode | null = null;
  if (purchase.isPending) busyCode = purchase.variables.itemCode;
  else if (purchase.isSuccess && shop.isFetching) busyCode = purchase.data.itemCode;

  if (shop.data) return <ShopView shop={shop.data} busyCode={busyCode} onBuy={buy} onBoostEnd={refreshAfterBoost} />;
  if (shop.error) throw shop.error;
  return <ShopSkeleton />;
}
