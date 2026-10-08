import type { MeUser } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { NavItemLink } from "./NavItemLink";
import { activeNavKey, NAV_ITEMS } from "./navItems";

interface BottomNavProps {
  pathname: string;
  user: MeUser | undefined;
  className?: string;
}

/** The phone's tab bar: six destinations as icon tiles. Settings is reached from the Profile page. */
export function BottomNav({ pathname, user, className }: BottomNavProps) {
  const active = activeNavKey(pathname);
  return (
    <nav
      aria-label="Main"
      className={cn(
        "fixed inset-x-0 bottom-0 z-(--z-topbar) h-[calc(82px+env(safe-area-inset-bottom))] border-t-2 border-line bg-page",
        "px-2 pt-4 pb-[calc(16px+env(safe-area-inset-bottom))]",
        className,
      )}
    >
      <ul className="flex justify-around">
        {NAV_ITEMS.map((item) => (
          <li key={item.key}>
            <NavItemLink item={item} active={item.key === active} layout="tab" user={user} />
          </li>
        ))}
      </ul>
    </nav>
  );
}
