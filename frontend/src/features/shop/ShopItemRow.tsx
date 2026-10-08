import type { ShopItemOut } from "@/lib/api/types";
import { ShopItemAction } from "./ShopItemAction";
import { ShopItemArt } from "./ShopItemArt";
import { ShopItemMeta } from "./ShopItemMeta";

interface ShopItemRowProps {
  item: ShopItemOut;
  busy: boolean;
  onBuy: (item: ShopItemOut) => void;
  onBoostEnd?: () => void;
}

/**
 * One item: a 96 px picture, its name, description and status line, and the action at the end. On the narrowest
 * phones the picture shrinks to 64 px and the action moves under the text.
 */
export function ShopItemRow({ item, busy, onBuy, onBoostEnd }: ShopItemRowProps) {
  return (
    <li className="grid grid-cols-[64px_1fr] items-center gap-x-4 gap-y-3 border-t-2 border-line py-6 min-[401px]:grid-cols-[96px_1fr_auto] min-[401px]:gap-x-6">
      <span className="size-16 min-[401px]:size-24 [&>svg]:size-full">
        <ShopItemArt code={item.code} size={96} />
      </span>
      <div className="min-w-0">
        <h3 className="text-card-title text-fg">{item.name}</h3>
        <p className="mt-1 text-body text-fg-2">{item.description}</p>
        <ShopItemMeta item={item} onBoostEnd={onBoostEnd} />
      </div>
      <div className="col-start-2 min-[401px]:col-start-3">
        <ShopItemAction item={item} busy={busy} onBuy={() => onBuy(item)} />
      </div>
    </li>
  );
}
