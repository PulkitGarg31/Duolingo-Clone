import type { ComponentType } from "react";
import type { IconProps } from "@/components/icons/Icon";
import { FreezeIcon } from "@/components/icons/FreezeIcon";
import { HeartRefillIcon } from "@/components/icons/HeartRefillIcon";
import { UnlimitedHeartIcon } from "@/components/icons/UnlimitedHeartIcon";
import { XpPotionIcon } from "@/components/icons/XpPotionIcon";
import type { ShopItemCode } from "@/lib/api/types";

const ART: Record<ShopItemCode, ComponentType<IconProps>> = {
  heart_refill: HeartRefillIcon,
  unlimited_hearts: UnlimitedHeartIcon,
  streak_freeze: FreezeIcon,
  xp_boost_15: XpPotionIcon,
};

/** An item's picture: a heart with a plus, the infinity heart, the ice-cube flame or the XP potion. */
export function ShopItemArt({ code, ...props }: IconProps & { code: ShopItemCode }) {
  const Art = ART[code];
  return <Art {...props} />;
}
