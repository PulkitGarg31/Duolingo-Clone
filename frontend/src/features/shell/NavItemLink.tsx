import Link from "next/link";
import type { MeUser } from "@/lib/api/types";
import { NavIcon } from "./NavIcon";
import { navItemClassName, navLabelClassName, type NavLayout } from "./navItemStyles";
import type { NavItem } from "./navItems";
import { RailTooltip } from "./RailTooltip";

interface NavItemLinkProps {
  item: NavItem;
  active: boolean;
  layout: NavLayout;
  user: MeUser | undefined;
}

/** One destination in the sidebar, the icon rail or the bottom bar. */
export function NavItemLink({ item, active, layout, user }: NavItemLinkProps) {
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      aria-label={layout === "sidebar" ? undefined : item.label}
      className={navItemClassName(layout, active)}
    >
      <NavIcon navKey={item.key} user={user} size={layout === "tab" ? 36 : 32} />
      {layout === "sidebar" && <span className={navLabelClassName(active)}>{item.label}</span>}
      {layout === "rail" && <RailTooltip label={item.label} />}
    </Link>
  );
}
