"use client";

import * as PopoverPrimitive from "@radix-ui/react-popover";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useId, useRef, useState, type FocusEvent, type PointerEvent, type ReactElement, type ReactNode } from "react";
import { useFadeSeconds } from "./transitions";

const ARROW_WIDTH = 16;
const ARROW_HEIGHT = 8;

interface TooltipProps {
  content: ReactNode;
  /** One element that accepts a ref and event handlers, such as a button. */
  children: ReactElement;
  side?: "top" | "right" | "bottom" | "left";
  /** Hover time before it shows. */
  delayMs?: number;
}

/**
 * A small dark label that appears after hovering (300 ms) or keyboard-focusing its trigger, and hides on
 * leave, blur, Esc or a click elsewhere. It never takes focus or the pointer. Touch screens skip it, so it
 * must only repeat what the trigger already conveys.
 */
export function Tooltip({ content, children, side = "top", delayMs = 300 }: TooltipProps) {
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const id = useId();
  const fade = useFadeSeconds();

  useEffect(() => () => clearTimeout(timer.current), []);

  function show(delay: number) {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(true), delay);
  }

  function hide() {
    clearTimeout(timer.current);
    setOpen(false);
  }

  function handlePointerEnter(event: PointerEvent<HTMLElement>) {
    if (event.pointerType === "mouse") show(delayMs);
  }

  function handleFocus(event: FocusEvent<HTMLElement>) {
    // A click also focuses the trigger; only keyboard focus should reveal the label.
    if (event.currentTarget.matches(":focus-visible")) show(0);
  }

  return (
    <PopoverPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) hide();
      }}
    >
      {/* The anchor merges these props into the child element instead of wrapping it. */}
      <PopoverPrimitive.Anchor
        asChild
        aria-describedby={open ? id : undefined}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={hide}
        onFocus={handleFocus}
        onBlur={hide}
      >
        {children}
      </PopoverPrimitive.Anchor>
      <AnimatePresence>
        {open && (
          <PopoverPrimitive.Portal forceMount>
            <PopoverPrimitive.Content
              forceMount
              asChild
              id={id}
              role="tooltip"
              side={side}
              sideOffset={4}
              collisionPadding={8}
              onOpenAutoFocus={(event) => event.preventDefault()}
              onCloseAutoFocus={(event) => event.preventDefault()}
            >
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: fade(0.15) }}
                className="pointer-events-none z-(--z-popover) max-w-[min(320px,calc(100vw-16px))] rounded-[7px] bg-inverse p-2 text-body text-page"
              >
                {content}
                <PopoverPrimitive.Arrow asChild width={ARROW_WIDTH} height={ARROW_HEIGHT}>
                  <svg viewBox={`0 0 ${ARROW_WIDTH} ${ARROW_HEIGHT}`} className="block fill-inverse">
                    <path d={`M0 0 L${ARROW_WIDTH / 2} ${ARROW_HEIGHT} L${ARROW_WIDTH} 0 Z`} />
                  </svg>
                </PopoverPrimitive.Arrow>
              </motion.div>
            </PopoverPrimitive.Content>
          </PopoverPrimitive.Portal>
        )}
      </AnimatePresence>
    </PopoverPrimitive.Root>
  );
}
