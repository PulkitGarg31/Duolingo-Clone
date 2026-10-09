"use client";

import Link from "next/link";
import { useId, type ReactNode } from "react";
import { MoreIcon } from "@/components/icons";
import { Divider, Popover, PopoverContent, PopoverTrigger, Switch } from "@/components/ui";
import type { MeUser } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { useLogout, useUpdateSettings } from "@/lib/queries/mutations";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { useComingSoon } from "./ComingSoon";
import { navItemClassName, navLabelClassName } from "./navItemStyles";
import { RailTooltip } from "./RailTooltip";
import { useHoverPopover } from "./useHoverPopover";

/**
 * The menu opens beside the navigation's outer edge: the item sits 16 px inside the fixed sidebar or rail, which
 * is drawn above popovers, so the arrow (12 px) has to start past that edge.
 */
const MENU_OFFSET = 16 + 12;

interface MoreMenuProps {
  layout: "sidebar" | "rail";
  /** Undefined while `me` loads: the account part of the menu waits for it. */
  user: MeUser | undefined;
}

/**
 * The last menu item, MORE: settings, the dark mode switch, help, about, and the account: LOG OUT when signed
 * in, a "Demo account" note with SIGN IN on the shared demo learner.
 */
export function MoreMenu({ layout, user }: MoreMenuProps) {
  const popover = useHoverPopover();
  return (
    <Popover open={popover.open} onOpenChange={popover.setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={layout === "rail" ? "More" : undefined}
          className={cn(navItemClassName(layout, false), "data-[state=open]:bg-subtle")}
          {...popover.triggerProps}
        >
          <MoreIcon size={32} className="shrink-0" />
          {layout === "sidebar" ? <span className={navLabelClassName(false)}>More</span> : <RailTooltip label="More" />}
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="right"
        align="center"
        offset={MENU_OFFSET}
        autoFocus={popover.autoFocus}
        aria-label="More"
        className="min-w-[240px] py-2"
        {...popover.contentProps}
      >
        <MoreMenuContent user={user} onClose={() => popover.setOpen(false)} />
      </PopoverContent>
    </Popover>
  );
}

function MoreMenuContent({ user, onClose }: { user: MeUser | undefined; onClose: () => void }) {
  const showComingSoon = useComingSoon();
  return (
    <nav aria-label="More">
      <ul>
        <li>
          <MenuEntry href="/settings" onSelect={onClose}>
            Settings
          </MenuEntry>
        </li>
        <li>
          <DarkModeEntry />
        </li>
      </ul>
      <Divider className="my-2" />
      <ul>
        <li>
          <MenuEntry
            onSelect={() => {
              onClose();
              showComingSoon("the help center");
            }}
          >
            Help
          </MenuEntry>
        </li>
        <li>
          <MenuEntry href="/welcome" onSelect={onClose}>
            About this clone
          </MenuEntry>
        </li>
      </ul>
      {user && (
        <>
          <Divider className="my-2" />
          {user.isDemo ? <DemoAccountEntries onClose={onClose} /> : <LogOutEntry email={user.email} />}
        </>
      )}
    </nav>
  );
}

/** The shared demo learner: a short note on what that means, and the ways to an account of one's own. */
function DemoAccountEntries({ onClose }: { onClose: () => void }) {
  return (
    <>
      <div className="px-5 pt-2 pb-1">
        <p className="text-caption text-fg-3 uppercase">Demo account</p>
        <p className="mt-1 max-w-[220px] text-[13px] leading-4 font-semibold text-fg-3">
          Everyone trying the demo shares this progress.
        </p>
      </div>
      <ul>
        <li>
          <MenuEntry href="/signup" onSelect={onClose}>
            Create a profile
          </MenuEntry>
        </li>
        <li>
          <MenuEntry href="/login" onSelect={onClose}>
            Sign in
          </MenuEntry>
        </li>
      </ul>
    </>
  );
}

/** LOG OUT, with the account's email under it. The menu stays open on its loading state until it lands. */
function LogOutEntry({ email }: { email: string | null }) {
  const logout = useLogout();
  return (
    <div>
      <MenuEntry onSelect={() => logout.mutate()} busy={logout.isPending}>
        Log out
      </MenuEntry>
      {email && <p className="-mt-2 truncate px-5 pb-2 text-[13px] leading-4 font-semibold text-fg-3">{email}</p>}
    </div>
  );
}

const ENTRY_CLASSES =
  "flex h-[52px] w-full cursor-pointer items-center pr-10 pl-5 text-left text-[15px] leading-4 font-extrabold " +
  "tracking-[0.8px] text-fg-2 uppercase hover:bg-subtle focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus";

interface MenuEntryProps {
  href?: string;
  onSelect: () => void;
  /** A button whose action is under way: dimmed and ignoring clicks. */
  busy?: boolean;
  children: ReactNode;
}

/** A menu row: a link when it has an `href`, otherwise a button. */
function MenuEntry({ href, onSelect, busy = false, children }: MenuEntryProps) {
  if (href) {
    return (
      <Link href={href} onClick={onSelect} className={ENTRY_CLASSES}>
        {children}
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={busy ? undefined : onSelect}
      aria-busy={busy || undefined}
      aria-disabled={busy || undefined}
      className={cn(ENTRY_CLASSES, busy && "cursor-default opacity-60")}
    >
      {children}
    </button>
  );
}

/**
 * Shows the theme in effect (on when dark is painted, whether chosen or inherited from the system) and saves an
 * explicit light or dark choice. "System default" is only offered in Settings.
 */
function DarkModeEntry() {
  const { resolvedTheme } = useTheme();
  const updateSettings = useUpdateSettings();
  const labelId = useId();
  return (
    <div className="flex h-[52px] items-center justify-between gap-6 pr-4 pl-5">
      <span id={labelId} className="text-[15px] leading-4 font-extrabold tracking-[0.8px] text-fg-2 uppercase">
        Dark mode
      </span>
      <Switch
        aria-labelledby={labelId}
        checked={resolvedTheme === "dark"}
        onCheckedChange={(dark) => updateSettings.mutate({ theme: dark ? "dark" : "light" })}
      />
    </div>
  );
}
