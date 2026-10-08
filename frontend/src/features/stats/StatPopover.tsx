"use client";

import { useState, type ReactNode } from "react";
import { Popover, PopoverContent, PopoverTrigger, Sheet } from "@/components/ui";
import { useHoverPopover } from "@/features/shell/useHoverPopover";
import { cn } from "@/lib/cn";
import { StatButton, type StatButtonProps } from "./StatButton";

/**
 * Where a stats row sits: the top of the right rail (≥ 1100 px), the sticky header over the main column
 * (768–1099 px) or the phone's top bar, whose details open as a sheet dropping from under the bar.
 */
export type StatPlacement = "rail" | "header" | "topbar";

/** `data-*` attributes, which object literals cannot pass through a button's prop type otherwise. */
type DataAttributes = { [name: `data-${string}`]: string };

interface StatPopoverProps {
  placement: StatPlacement;
  /** Names the popover or sheet for screen readers; the content shows its own heading. */
  title: string;
  /** Popover width in px (desktop). */
  width: 320 | 380;
  /** The stat button; the popover handles its clicks. */
  button: Omit<StatButtonProps, "onClick" | "compact"> & DataAttributes;
  /** Padding of the desktop panel, when it differs from 24 × 16 px. */
  panelClassName?: string;
  /** The details, given a function that closes them (for links that navigate away). */
  children: (close: () => void) => ReactNode;
}

/** A stat with its details: a hover popover on wider screens, a dropdown sheet in the phone's top bar. */
export function StatPopover({ placement, ...props }: StatPopoverProps) {
  return placement === "topbar" ? <StatSheet {...props} /> : <StatHoverPopover {...props} />;
}

type VariantProps = Omit<StatPopoverProps, "placement">;

function StatHoverPopover({ title, width, button, panelClassName, children }: VariantProps) {
  const popover = useHoverPopover();
  return (
    <Popover open={popover.open} onOpenChange={popover.setOpen}>
      <PopoverTrigger asChild>
        <StatButton {...button} {...popover.triggerProps} />
      </PopoverTrigger>
      <PopoverContent
        width={width}
        autoFocus={popover.autoFocus}
        aria-label={title}
        className={cn("px-4 py-6", panelClassName)}
        {...popover.contentProps}
      >
        {children(() => popover.setOpen(false))}
      </PopoverContent>
    </Popover>
  );
}

function StatSheet({ title, button, children }: VariantProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <StatButton {...button} compact aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)} />
      <Sheet side="top" open={open} onOpenChange={setOpen} title={title} hideTitle>
        <div className="mx-auto max-w-[420px]">{children(() => setOpen(false))}</div>
      </Sheet>
    </>
  );
}
