"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { useState, type ComponentProps, type FocusEvent, type KeyboardEvent, type MouseEvent } from "react";
import { cn } from "@/lib/cn";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "danger"
  | "gold"
  | "super"
  | "white"
  | "outline"
  | "outline-muted"
  | "outline-ink"
  | "ghost"
  | "ghost-danger"
  | "locked";

export type ButtonSize =
  | "sm"
  | "md"
  | "lg"
  | "key"
  | "icon"
  | "round"
  | "inline"
  | "speaker-xl"
  | "speaker-slow"
  | "speaker-sm";

export interface ButtonStyle {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Stretches the button to its container's width at every breakpoint. */
  fullWidth?: boolean;
}

/**
 * The 3D recipe. The lip is a solid offset shadow in a darker shade, never a blur. Pressing (the global
 * `.pressable:active` rule, or `data-pressed` for keyboard presses) moves the face down by the lip height and
 * drops the shadow, so the lip's bottom edge stays put while the face sinks into it. The bottom margin
 * reserves the lip, so a press never shifts the layout around the button.
 */
const BASE =
  "pressable relative inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap " +
  "select-none touch-manipulation [-webkit-tap-highlight-color:transparent] font-extrabold leading-[1.2] " +
  "bg-(--btn-bg) text-(--btn-fg) shadow-[0_var(--lip)_0_var(--btn-lip)] mb-(--lip) " +
  // While pressed the face sits a lip lower; this strip keeps the area it left clickable, so a press that
  // starts on the top edge still ends on the button and counts as a click.
  "active:after:absolute active:after:inset-x-0 active:after:bottom-0 active:after:-top-(--lip) " +
  "data-pressed:[transform:translateY(var(--lip))] data-pressed:shadow-none " +
  "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus " +
  // Disabled buttons are grey and flat, sitting in the pressed position.
  "disabled:cursor-default disabled:shadow-none disabled:[transform:translateY(var(--lip))] " +
  "disabled:[--btn-fg:var(--c-disabled-fg)]";

/** Each variant sets only the recipe's variables: face, lip and label colours. */
const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "[--btn-bg:var(--c-primary)] [--btn-lip:var(--c-primary-lip)] [--btn-fg:var(--c-fg-on-color)]",
  secondary: "[--btn-bg:var(--c-secondary)] [--btn-lip:var(--c-secondary-lip)] [--btn-fg:var(--c-fg-on-color)]",
  danger: "[--btn-bg:var(--c-danger)] [--btn-lip:var(--c-danger-lip)] [--btn-fg:var(--c-fg-on-color)]",
  gold: "[--btn-bg:var(--c-gold)] [--btn-lip:var(--c-gold-lip)] [--btn-fg:var(--c-gold-fg)]",
  super: "[--btn-bg:var(--c-super)] [--btn-lip:var(--c-super-lip)] [--btn-fg:var(--c-fg-on-color-fixed)]",
  // For coloured panels. The panel sets --surface to its own background: the label takes that colour and
  // the lip is a pale tint of it. Light panels (gold) also set --surface-ink, a darker shade for the label.
  white:
    "[--btn-bg:var(--c-bg)] [--btn-fg:var(--surface-ink,var(--surface,var(--c-primary)))] " +
    "[--btn-lip:color-mix(in_srgb,var(--c-bg)_70%,var(--surface,var(--c-primary)))]",
  outline: "border-2 border-line [--btn-bg:var(--c-bg)] [--btn-lip:var(--c-line)] [--btn-fg:var(--c-fg-link)]",
  "outline-muted": "border-2 border-line [--btn-bg:var(--c-bg)] [--btn-lip:var(--c-line)] [--btn-fg:var(--c-fg-3)]",
  "outline-ink": "border-2 border-line [--btn-bg:var(--c-bg)] [--btn-lip:var(--c-line)] [--btn-fg:var(--c-fg)]",
  ghost: "[--btn-bg:transparent] [--btn-lip:transparent] [--btn-fg:var(--c-fg-link)]",
  "ghost-danger": "[--btn-bg:transparent] [--btn-lip:transparent] [--btn-fg:var(--c-danger)]",
  // Always rendered disabled, so the disabled styles paint it.
  locked: "",
};

type Family = "solid" | "outline" | "ghost";

/**
 * Lip height, hover and disabled face per family. Solid buttons have a 4 px lip; outline buttons a 2 px lip
 * under a 2 px border, so their bottom edge also reads as 4 px; ghost buttons have none and stay
 * transparent when disabled.
 */
const FAMILY_CLASSES: Record<Family, string> = {
  solid: "[--lip:4px] not-disabled:hover:brightness-110 disabled:[--btn-bg:var(--c-disabled)]",
  outline: "[--lip:2px] not-disabled:hover:brightness-95 disabled:[--btn-bg:var(--c-disabled)]",
  ghost: "[--lip:0px] not-disabled:hover:brightness-110",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "h-8 rounded-sm px-2 text-[14px]",
  md: "h-[50px] rounded-md px-4 text-[15px]",
  // The lesson footer's CHECK / CONTINUE: full width on phones, at least 150 px from 700 px up.
  lg: "h-[50px] rounded-md px-4 text-[15px] md:text-[17px]",
  // A typing key such as "á": one character in its natural case.
  key: "h-8 min-w-10 rounded-sm px-2 text-[17px]",
  icon: "size-12 rounded-md",
  round: "size-12 rounded-full",
  // Text-only links such as VIEW ALL: no box of their own.
  inline: "h-auto rounded-sm p-0 text-[15px]",
  // Listen exercise speakers; they shrink on short phones so the answer area stays on screen.
  "speaker-xl":
    "size-[100px] rounded-lg md:size-[140px] md:rounded-xl [@media(max-height:499px)]:size-[50px] [&_svg]:size-1/2",
  "speaker-slow": "size-[70px] rounded-lg [@media(max-height:499px)]:size-[35px] [&_svg]:size-[60%]",
  "speaker-sm": "size-12 rounded-md [&_svg]:size-[60%]",
};

function familyOf(variant: ButtonVariant): Family {
  if (variant.startsWith("outline")) return "outline";
  if (variant.startsWith("ghost")) return "ghost";
  return "solid";
}

/** The button look as a class list, for elements other than `<button>` (see `ButtonLink`). */
export function buttonClassName({ variant = "primary", size = "md", fullWidth = false }: ButtonStyle = {}): string {
  return cn(
    BASE,
    VARIANT_CLASSES[variant],
    FAMILY_CLASSES[familyOf(variant)],
    SIZE_CLASSES[size],
    // Labels are uppercase with 0.8 px tracking; only a typing key keeps its letter as written.
    size !== "key" && "tracking-[0.8px] uppercase",
    fullWidth ? "w-full" : size === "lg" && "w-full md:w-auto md:min-w-[150px]",
  );
}

export interface ButtonProps extends ComponentProps<"button">, ButtonStyle {
  /** Replaces the label with bouncing dots, keeps the width and ignores clicks until the work finishes. */
  loading?: boolean;
}

/**
 * Duolingo's 3D button. Labels are uppercased by CSS, so write them in sentence case; icons go before the
 * label. Icon-only sizes need an `aria-label`.
 */
export function Button({
  variant = "primary",
  size = "md",
  fullWidth = false,
  loading = false,
  disabled = false,
  type = "button",
  className,
  children,
  onClick,
  onKeyDown,
  onKeyUp,
  onBlur,
  ...rest
}: ButtonProps) {
  // Space presses get :active from the browser; Enter does not, so keyboard presses are mirrored here.
  const [keyPressed, setKeyPressed] = useState(false);

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    onKeyDown?.(event);
    if (event.key === "Enter" || event.key === " ") setKeyPressed(true);
  }

  function handleKeyUp(event: KeyboardEvent<HTMLButtonElement>) {
    onKeyUp?.(event);
    setKeyPressed(false);
  }

  function handleBlur(event: FocusEvent<HTMLButtonElement>) {
    onBlur?.(event);
    setKeyPressed(false);
  }

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    if (loading) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  }

  return (
    <button
      type={type}
      disabled={disabled || variant === "locked"}
      aria-busy={loading || undefined}
      aria-disabled={loading || undefined}
      data-pressed={keyPressed || undefined}
      className={cn(buttonClassName({ variant, size, fullWidth }), className)}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      onBlur={handleBlur}
      {...rest}
    >
      {/* `contents` keeps the children laid out by the button itself; while loading they turn invisible but
          keep their space (so the width stays locked) and stay readable to screen readers. */}
      <span className={cn("contents", loading && "text-transparent [&_svg]:invisible")}>{children}</span>
      {loading && <LoadingDots />}
    </button>
  );
}

export type ButtonLinkProps = ComponentProps<typeof Link> & Omit<ButtonStyle, "variant"> & {
  variant?: Exclude<ButtonVariant, "locked">;
};

/** A navigation link that looks like a Button (BACK TO LEARNING, GO TO SHOP, ...). */
export function ButtonLink({ variant, size, fullWidth, className, ...rest }: ButtonLinkProps) {
  return <Link className={cn(buttonClassName({ variant, size, fullWidth }), className)} {...rest} />;
}

const DOTS = [0, 1, 2] as const;

/** Three 6 px dots in the label colour, bouncing in turn. */
function LoadingDots() {
  return (
    <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center gap-1.5">
      {DOTS.map((index) => (
        <motion.span
          key={index}
          className="size-1.5 rounded-full bg-(--btn-fg)"
          animate={{ y: [0, -4, 0] }}
          transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut", delay: index * 0.15 }}
        />
      ))}
    </span>
  );
}
