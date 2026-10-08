import type { ComponentType } from "react";
import { LeaderboardsIcon, LearnIcon, PracticeIcon, QuestsIcon, ShopIcon, type IconProps } from "@/components/icons";
import { Avatar } from "@/components/ui";
import type { MeUser } from "@/lib/api/types";
import type { NavKey } from "./navItems";

const ICONS: Record<Exclude<NavKey, "profile">, ComponentType<IconProps>> = {
  learn: LearnIcon,
  practice: PracticeIcon,
  leaderboard: LeaderboardsIcon,
  quests: QuestsIcon,
  shop: ShopIcon,
};

interface NavIconProps {
  navKey: NavKey;
  /** The learner, whose avatar is the Profile icon; a dashed placeholder until `me` loads. */
  user: MeUser | undefined;
  size: 32 | 36;
}

/** A destination's icon: drawn art, or for Profile the learner's own avatar. */
export function NavIcon({ navKey, user, size }: NavIconProps) {
  if (navKey === "profile") {
    return (
      <span className="grid shrink-0 place-items-center" style={{ width: size, height: size }}>
        <Avatar name={user?.displayName ?? ""} color={user?.avatarColor} size={32} />
      </span>
    );
  }
  const Icon = ICONS[navKey];
  return <Icon size={size} className="shrink-0" />;
}
