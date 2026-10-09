import Link from "next/link";
import { OwlHead } from "@/components/mascot";
import type { MeUser } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { APP_NAME } from "@/lib/constants";
import { MoreMenu } from "./MoreMenu";
import { NavItemLink } from "./NavItemLink";
import { activeNavKey, NAV_ITEMS } from "./navItems";

interface IconRailProps {
  pathname: string;
  user: MeUser | undefined;
  className?: string;
}

/**
 * The 88 px icon-only menu of tablets and small laptops, with the owl's head for a logo. Item labels appear
 * beside the rail on hover, so the rail itself must not clip its overflow.
 */
export function IconRail({ pathname, user, className }: IconRailProps) {
  const active = activeNavKey(pathname);
  return (
    <nav
      aria-label="Main"
      className={cn(
        "fixed inset-y-0 left-0 z-(--z-topbar) w-[88px] flex-col items-center border-r-2 border-line bg-page px-4",
        className,
      )}
    >
      <Link
        href="/learn"
        aria-label={`${APP_NAME}, go to Learn`}
        className="mt-9 mb-[25px] rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        <OwlHead size={40} />
      </Link>
      <ul className="flex flex-col gap-2">
        {NAV_ITEMS.map((item) => (
          <li key={item.key}>
            <NavItemLink item={item} active={item.key === active} layout="rail" user={user} />
          </li>
        ))}
        <li>
          <MoreMenu layout="rail" user={user} />
        </li>
      </ul>
    </nav>
  );
}
