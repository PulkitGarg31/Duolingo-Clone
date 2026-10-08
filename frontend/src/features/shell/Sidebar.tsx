import type { MeUser } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { MoreMenu } from "./MoreMenu";
import { NavItemLink } from "./NavItemLink";
import { activeNavKey, NAV_ITEMS } from "./navItems";
import { Wordmark } from "./Wordmark";

interface SidebarProps {
  pathname: string;
  user: MeUser | undefined;
  className?: string;
}

/** The 256 px menu with the wordmark and labelled items, fixed along the left edge on wide screens. */
export function Sidebar({ pathname, user, className }: SidebarProps) {
  const active = activeNavKey(pathname);
  return (
    <nav
      aria-label="Main"
      className={cn(
        "fixed inset-y-0 left-0 z-(--z-topbar) w-[256px] flex-col overflow-y-auto border-r-2 border-line bg-page px-4",
        "[scrollbar-width:none]",
        className,
      )}
    >
      <div className="pt-8 pb-[30px] pl-4">
        <Wordmark />
      </div>
      <ul className="flex flex-col gap-2">
        {NAV_ITEMS.map((item) => (
          <li key={item.key}>
            <NavItemLink item={item} active={item.key === active} layout="sidebar" user={user} />
          </li>
        ))}
        <li>
          <MoreMenu layout="sidebar" />
        </li>
      </ul>
    </nav>
  );
}
