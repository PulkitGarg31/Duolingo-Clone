"use client";

import { createContext, useContext, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** The element inside the right rail that a page can fill, or null where the rail has no slot. */
export const RightRailSlotContext = createContext<HTMLElement | null>(null);

/**
 * Renders a page's own rail content (the settings section menu) inside the right rail. It renders nothing
 * where the rail has no slot or is hidden, so the page must also show that content in its main column below
 * 1100 px.
 */
export function RightRailPortal({ children }: { children: ReactNode }) {
  const slot = useContext(RightRailSlotContext);
  return slot ? createPortal(children, slot) : null;
}
