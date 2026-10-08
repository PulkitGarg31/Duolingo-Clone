"use client";

import { useId, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface TabItem<V extends string> {
  value: V;
  label: ReactNode;
  disabled?: boolean;
}

interface TabsProps<V extends string> {
  items: readonly TabItem<V>[];
  value: V;
  onValueChange: (value: V) => void;
  /** Names the tab list for screen readers. */
  label: string;
  /** Tabs share the full width equally (a card's FOLLOWING / FOLLOWERS) instead of sitting at the start. */
  stretch?: boolean;
  /** Renders the active tab's panel. Leave it out when the tabs only switch something elsewhere. */
  children?: (value: V) => ReactNode;
  className?: string;
}

/**
 * Uppercase tabs over a 2 px rule; the active tab's macaw underline covers the rule. A strip wider than the
 * screen scrolls sideways (the settings menu on phones). Arrow keys, Home and End move between tabs (only the
 * active tab is in the Tab order).
 */
export function Tabs<V extends string>({ items, value, onValueChange, label, stretch = false, children, className }: TabsProps<V>) {
  const baseId = useId();
  const tabId = (tab: V) => `${baseId}-tab-${tab}`;
  const panelId = `${baseId}-panel`;

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const enabled = items.filter((item) => !item.disabled);
    const index = enabled.findIndex((item) => item.value === value);
    let target: TabItem<V> | undefined;
    switch (event.key) {
      case "ArrowRight":
        target = enabled[(index + 1) % enabled.length];
        break;
      case "ArrowLeft":
        target = enabled[(index - 1 + enabled.length) % enabled.length];
        break;
      case "Home":
        target = enabled[0];
        break;
      case "End":
        target = enabled[enabled.length - 1];
        break;
      default:
        return;
    }
    if (!target) return;
    event.preventDefault();
    onValueChange(target.value);
    document.getElementById(tabId(target.value))?.focus();
  }

  return (
    <div className={cn("min-w-0", className)}>
      {/* The rule is an inset shadow rather than a border: it stays put while the strip scrolls, and the tabs'
          own bottom borders paint over it. */}
      <div
        role="tablist"
        aria-label={label}
        onKeyDown={handleKeyDown}
        className="flex overflow-x-auto shadow-[inset_0_-2px_0_var(--c-line)] [scrollbar-width:none]"
      >
        {items.map((item) => {
          const active = item.value === value;
          return (
            <button
              key={item.value}
              id={tabId(item.value)}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls={active && children ? panelId : undefined}
              tabIndex={active ? 0 : -1}
              disabled={item.disabled}
              onClick={() => onValueChange(item.value)}
              className={cn(
                "cursor-pointer rounded-t-sm border-b-2 text-[15px] leading-[18px] font-extrabold tracking-[0.8px] whitespace-nowrap uppercase",
                // Drawn inside the tab, since the scrolling strip clips anything outside it.
                "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus",
                "disabled:cursor-default disabled:opacity-60",
                stretch ? "flex-1 px-2.5 pb-3" : "shrink-0 px-4 pb-5",
                active
                  ? "border-link text-link"
                  : "border-transparent text-fg-2 enabled:hover:border-link enabled:hover:text-link",
              )}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      {children && (
        <div role="tabpanel" id={panelId} aria-labelledby={tabId(value)} tabIndex={0} className="outline-none">
          {children(value)}
        </div>
      )}
    </div>
  );
}
