"use client";

import Link from "next/link";
import { useId, type ReactNode } from "react";
import { MoreIcon } from "@/components/icons";
import { Divider, Popover, PopoverContent, PopoverTrigger, Switch } from "@/components/ui";
import { cn } from "@/lib/cn";
import { useUpdateSettings } from "@/lib/queries/mutations";
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

/** The last menu item, MORE: settings, the dark mode switch, help, about, and a disabled log out. */
export function MoreMenu({ layout }: { layout: "sidebar" | "rail" }) {
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
        <MoreMenuContent onClose={() => popover.setOpen(false)} />
      </PopoverContent>
    </Popover>
  );
}

function MoreMenuContent({ onClose }: { onClose: () => void }) {
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
      <Divider className="my-2" />
      <div className="px-5 py-2">
        <button type="button" disabled className="text-[15px] leading-4 font-extrabold tracking-[0.8px] text-fg-2 uppercase opacity-60">
          Log out
        </button>
        <p className="mt-1 text-[13px] leading-4 font-semibold text-fg-3">Sign-in is simplified in this demo</p>
      </div>
    </nav>
  );
}

const ENTRY_CLASSES =
  "flex h-[52px] w-full cursor-pointer items-center pr-10 pl-5 text-left text-[15px] leading-4 font-extrabold " +
  "tracking-[0.8px] text-fg-2 uppercase hover:bg-subtle focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus";

/** A menu row: a link when it has an `href`, otherwise a button. */
function MenuEntry({ href, onSelect, children }: { href?: string; onSelect: () => void; children: ReactNode }) {
  if (href) {
    return (
      <Link href={href} onClick={onSelect} className={ENTRY_CLASSES}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onSelect} className={ENTRY_CLASSES}>
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
