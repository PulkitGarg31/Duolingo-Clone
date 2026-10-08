import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * A bordered list of rows split by 2 px rules: the settings section menu, the daily goal picker. Give it the
 * role that fits (`radiogroup` with `role="radio"` items, or a plain group of buttons).
 */
export function List({ className, ...rest }: ComponentProps<"div">) {
  return <div className={cn("rounded-[14px] border-2 border-line", className)} {...rest} />;
}

export interface ListItemProps extends ComponentProps<"button"> {
  selected?: boolean;
  /** Marks a selected row with a check badge on its top-right corner (the daily goal picker). */
  checkBadge?: boolean;
  /** A secondary value on the right, e.g. "20 XP per day". */
  detail?: ReactNode;
}

/**
 * One row of a List. A selected row turns blue and draws its own border over the list's lines (the overlay
 * below), so the highlight reads as one outlined row, as on Duolingo.
 */
export function ListItem({
  selected = false,
  checkBadge = false,
  detail,
  type = "button",
  className,
  children,
  ...rest
}: ListItemProps) {
  return (
    <button
      type={type}
      className={cn(
        "relative flex w-full cursor-pointer items-center justify-between gap-4 px-[25px] py-[17.5px] text-left text-body",
        "border-t-2 border-line first:rounded-t-[12px] first:border-t-0 last:rounded-b-[12px]",
        "focus-visible:z-[2] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
        "disabled:cursor-default disabled:opacity-60",
        selected
          ? cn(
              "z-[1] bg-selected text-fg-selected",
              // Covers the list's border and the rules above and below this row with the selected outline.
              "after:pointer-events-none after:absolute after:-inset-0.5 after:border-2 after:border-line-selected",
              "first:after:rounded-t-[14px] last:after:rounded-b-[14px]",
            )
          : "text-fg enabled:hover:bg-subtle",
        className,
      )}
      {...rest}
    >
      <span className="min-w-0">{children}</span>
      {detail !== undefined && <span className={cn("shrink-0", selected ? "text-fg-selected" : "text-fg-2")}>{detail}</span>}
      {selected && checkBadge && <CheckBadge />}
    </button>
  );
}

function CheckBadge() {
  return (
    <span
      aria-hidden="true"
      className="absolute -top-[7px] -right-[9px] z-[1] grid size-6 place-items-center rounded-full bg-fg-selected"
    >
      <svg width={12} height={10} viewBox="0 0 12 10" fill="none" className="stroke-on-color-fixed">
        <path d="M1.5 5.2 4.4 8 10.5 1.8" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}
