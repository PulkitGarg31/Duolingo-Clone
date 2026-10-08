import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

export type CardStatus = "idle" | "correct" | "incorrect";
export type CardPadding = "none" | "sm" | "md" | "lg";

export interface CardStyle {
  /** Adds the 2 px lip, the hover tint and the press. */
  interactive?: boolean;
  selected?: boolean;
  /** The verdict colours after an answer is checked; they win over `selected`. */
  status?: CardStatus;
  /** 12 px corners, for exercise tiles, instead of the 16 px card radius. */
  tile?: boolean;
  /** 0, 12 px 16 px, 16 px (default) or 20 px. Pass "none" to lay out the inside yourself. */
  padding?: CardPadding;
  /** Keeps the colours but stops hover and press (an answer locked after CHECK). */
  disabled?: boolean;
}

/** Each tone sets the card's three colours; the border and the lip share one. */
const TONE_CLASSES = {
  idle: "[--card-bg:var(--c-bg)] [--card-line:var(--c-line)] [--card-fg:var(--c-fg)]",
  selected: "[--card-bg:var(--c-bg-selected)] [--card-line:var(--c-line-selected)] [--card-fg:var(--c-fg-selected)]",
  correct: "[--card-bg:var(--c-correct-bg)] [--card-line:var(--c-correct-line)] [--card-fg:var(--c-correct-fg)]",
  incorrect: "[--card-bg:var(--c-wrong-bg)] [--card-line:var(--c-wrong-line)] [--card-fg:var(--c-wrong-fg)]",
} as const;

const PADDING_CLASSES: Record<CardPadding, string> = {
  none: "",
  sm: "px-4 py-3",
  md: "p-4",
  lg: "p-5",
};

/** The card look as a class list, for elements other than the two components below (a `Link`, say). */
export function cardClassName({
  interactive = false,
  selected = false,
  status = "idle",
  tile = false,
  padding = "md",
  disabled = false,
}: CardStyle = {}): string {
  const tone = status !== "idle" ? status : selected ? "selected" : "idle";
  return cn(
    "relative border-2 border-(--card-line) bg-(--card-bg) text-(--card-fg)",
    TONE_CLASSES[tone],
    tile ? "rounded-md" : "rounded-lg",
    PADDING_CLASSES[padding],
    interactive && "shadow-[0_2px_0_var(--card-line)]",
    interactive &&
      !disabled &&
      "pressable cursor-pointer select-none [--lip:2px] [-webkit-tap-highlight-color:transparent]",
    interactive && !disabled && tone === "idle" && "hover:bg-subtle",
  );
}

export interface CardProps extends ComponentProps<"div">, Omit<CardStyle, "disabled"> {}

/** A bordered panel: rail cards, statistics, option rows. With `interactive` it can sit inside a link. */
export function Card({ interactive, selected, status, tile, padding, className, ...rest }: CardProps) {
  return <div className={cn(cardClassName({ interactive, selected, status, tile, padding }), className)} {...rest} />;
}

export interface CardButtonProps extends ComponentProps<"button">, Omit<CardStyle, "interactive"> {}

/** A pressable card: answer choices, practice hub entries, option cards. */
export function CardButton({
  selected,
  status,
  tile,
  padding,
  disabled = false,
  type = "button",
  className,
  ...rest
}: CardButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={cn(
        cardClassName({ interactive: true, selected, status, tile, padding, disabled }),
        "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus",
        className,
      )}
      {...rest}
    />
  );
}
