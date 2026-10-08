"use client";

import { GemIcon } from "@/components/icons/GemIcon";
import { Button, ComingSoonPill } from "@/components/ui";
import { useComingSoon } from "@/features/shell/ComingSoon";
import type { ShopItemOut } from "@/lib/api/types";
import { formatTotal } from "@/lib/format";
import { shopActionState } from "./shopItems";

/** Every action button is at least 120 px wide, so prices and labels line up down the page. */
const ACTION_WIDTH = "min-w-[120px]";

interface PriceButtonProps {
  price: number;
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
}

function PriceButton({ price, disabled = false, loading = false, onClick }: PriceButtonProps) {
  return (
    <Button variant="outline" disabled={disabled} loading={loading} onClick={onClick} className={ACTION_WIDTH}>
      <GemIcon size={20} variant={disabled ? "inactive" : "active"} />
      {formatTotal(price)}
      <span className="sr-only">gems</span>
    </Button>
  );
}

/** A placeholder item: it stays clickable and opens the Coming soon modal. */
function ComingSoonButton({ feature }: { feature: string }) {
  const showComingSoon = useComingSoon();
  return (
    <Button
      variant="outline"
      onClick={() => showComingSoon(feature)}
      className={ACTION_WIDTH}
      aria-label={`${feature}: coming soon`}
    >
      <ComingSoonPill />
    </Button>
  );
}

interface ShopItemActionProps {
  item: ShopItemOut;
  /** This item's purchase is in flight. */
  busy: boolean;
  onBuy: () => void;
}

/**
 * The button at the end of an item's row: its price, or why it cannot be bought (FULL, EQUIPPED, too few gems).
 * Purchases need no confirmation, as on Duolingo.
 */
export function ShopItemAction({ item, busy, onBuy }: ShopItemActionProps) {
  const state = shopActionState(item);
  switch (state.kind) {
    case "buy":
      return <PriceButton price={state.price} loading={busy} onClick={onBuy} />;
    case "short":
      return (
        <span className="inline-flex flex-col items-center gap-1">
          <PriceButton price={state.price} disabled />
          <span className="text-[13px] leading-4 font-extrabold text-fg-3">Not enough gems</span>
        </span>
      );
    case "full":
      return (
        <Button variant="outline" disabled className={ACTION_WIDTH}>
          Full
        </Button>
      );
    case "equipped":
      return (
        <Button variant="outline" disabled className={ACTION_WIDTH}>
          Equipped
        </Button>
      );
    case "soon":
      return <ComingSoonButton feature={item.name} />;
  }
}
