"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useSyncExternalStore, type ReactNode } from "react";
import { DialogLayer, type DialogPlacement } from "./DialogLayer";

/** Below Tailwind's `sm` breakpoint (530 px) modals become sheets, unless their layout keeps them centred. */
const NARROW_QUERY = "(width < 33.125rem)";

type ModalLayout = "responsive" | "fullscreen" | "dialog";

/** Where each layout puts the modal on a phone; from 530 px up every modal is a centred card. */
const PHONE_PLACEMENT: Record<ModalLayout, DialogPlacement> = {
  responsive: "bottom",
  fullscreen: "full",
  dialog: "center",
};

function subscribeToNarrow(onChange: () => void): () => void {
  const media = window.matchMedia(NARROW_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

const isNarrow = () => window.matchMedia(NARROW_QUERY).matches;

interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  /** Body copy under the title. */
  description?: ReactNode;
  /** The picture on top, 120–160 px (an owl pose, a badge). */
  illustration?: ReactNode;
  /** Buttons, stacked full width with 8 px gaps. */
  actions?: ReactNode;
  /** Anything else, between the copy and the actions. */
  children?: ReactNode;
  /** 480 px wide, or 420 px for the compact Coming soon and achievement modals. */
  size?: "md" | "sm";
  /**
   * On phones (below 530 px) "responsive" becomes a bottom sheet, "fullscreen" a sheet covering the whole screen
   * with the buttons at the bottom (busy modals such as out of hearts), and "dialog" stays centred (tiny
   * confirmations).
   */
  layout?: ModalLayout;
  /** False keeps Esc and scrim clicks from closing it; one of the actions must. */
  dismissible?: boolean;
}

/**
 * A centred dialog over a dimmed page: picture, title, copy, then full-width buttons. Focus is trapped
 * inside; `autoFocus` on an action picks the button that starts focused when the learner opened the modal.
 * One that opens by itself (on page load, say) starts with focus on its panel, so no button lights up unasked.
 */
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  illustration,
  actions,
  children,
  size = "md",
  layout = "responsive",
  dismissible = true,
}: ModalProps) {
  const narrow = useSyncExternalStore(subscribeToNarrow, isNarrow, () => false);
  const placement = narrow ? PHONE_PLACEMENT[layout] : "center";
  return (
    <DialogLayer
      open={open}
      onOpenChange={onOpenChange}
      placement={placement}
      dismissible={dismissible}
      style={placement === "center" ? { width: `min(${size === "sm" ? 420 : 480}px, 100%)` } : undefined}
    >
      {/* On a full-screen sheet the copy centres in the space above the buttons, which sit at the bottom. */}
      <div className={placement === "full" ? "my-auto" : undefined}>
        <div className="flex flex-col items-center text-center">
          {illustration && <div className="mb-4 flex justify-center">{illustration}</div>}
          <DialogPrimitive.Title className="text-title text-fg-strong">{title}</DialogPrimitive.Title>
          {description && (
            <DialogPrimitive.Description className="mt-2 text-small text-fg-2 sm:text-body xl:text-subtitle [&_a]:text-link">
              {description}
            </DialogPrimitive.Description>
          )}
        </div>
        {children && <div className="mt-6">{children}</div>}
      </div>
      {actions && <div className="mt-6 grid gap-2">{actions}</div>}
    </DialogLayer>
  );
}
