"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import type { ReactNode } from "react";
import { DialogLayer } from "./DialogLayer";

interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Names the sheet for screen readers, and is shown on top unless `hideTitle` is set. */
  title: ReactNode;
  /** For content that brings its own heading. */
  hideTitle?: boolean;
  /**
   * "bottom": rises from the bottom edge with a grab handle; swipe it down to close.
   * "top": drops down from under the phone's top bar (the stats dropdowns), with the scrim below it.
   */
  side?: "bottom" | "top";
  dismissible?: boolean;
  children: ReactNode;
}

/** A full-width panel for phones, anchored to the screen edge, over a dimmed page. */
export function Sheet({ open, onOpenChange, title, hideTitle = false, side = "bottom", dismissible = true, children }: SheetProps) {
  return (
    <DialogLayer open={open} onOpenChange={onOpenChange} placement={side} dismissible={dismissible} handle={side === "bottom"}>
      <DialogPrimitive.Title className={hideTitle ? "sr-only" : "mb-4 text-center text-title text-fg-strong"}>
        {title}
      </DialogPrimitive.Title>
      {children}
    </DialogLayer>
  );
}
