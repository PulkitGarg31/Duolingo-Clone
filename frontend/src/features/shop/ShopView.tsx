import type { ShopItemCode, ShopItemOut, ShopOut } from "@/lib/api/types";
import { GemPacks } from "./GemPacks";
import { ShopHeader } from "./ShopHeader";
import { ShopItemRow } from "./ShopItemRow";
import { groupBySection } from "./shopItems";

export interface ShopViewProps {
  shop: ShopOut;
  /** The item whose purchase is in flight, shown with a loading button. */
  busyCode: ShopItemCode | null;
  onBuy: (item: ShopItemOut) => void;
  /** Called when a running XP Boost runs out. */
  onBoostEnd?: () => void;
}

/** The shop: the gem balance, then Hearts, Power-Ups and the gem packs still to come. */
export function ShopView({ shop, busyCode, onBuy, onBoostEnd }: ShopViewProps) {
  return (
    <div className="mx-auto w-full max-w-[592px] px-4 pt-6 pb-12 lg:px-0">
      <ShopHeader gems={shop.gems} />
      {groupBySection(shop.items).map(({ section, title, items }) => (
        <section key={section} className="mt-8">
          <h2 className="mb-2 text-[22px]/7 font-extrabold text-fg-strong md:text-heading">{title}</h2>
          <ul>
            {items.map((item) => (
              <ShopItemRow
                key={item.code}
                item={item}
                busy={busyCode === item.code}
                onBuy={onBuy}
                onBoostEnd={onBoostEnd}
              />
            ))}
          </ul>
        </section>
      ))}
      <GemPacks />
    </div>
  );
}
