import { ChestIcon } from "./ChestIcon";
import type { IconProps } from "./Icon";

/** Quests (nav): the closed treasure chest that quests pay out. */
export function QuestsIcon(props: IconProps) {
  return <ChestIcon variant="closed" {...props} />;
}
