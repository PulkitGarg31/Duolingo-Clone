"use client";

import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

export interface SwitchProps extends Omit<ComponentProps<"button">, "role" | "onChange"> {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

/**
 * An on/off toggle: a 57 × 24 track with a raised knob (a 4 px bottom border gives it the 3D edge) that
 * slides across. The button itself is 44 px tall, so the touch target is larger than the track. Label it with
 * a `<label>`, `aria-label` or `aria-labelledby`.
 */
export function Switch({ checked, onCheckedChange, disabled, className, onClick, ...rest }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) onCheckedChange(!checked);
      }}
      className={cn(
        "relative h-11 w-[57px] shrink-0 cursor-pointer rounded-md",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
        "disabled:cursor-default disabled:opacity-60",
        className,
      )}
      {...rest}
    >
      <span
        aria-hidden="true"
        className={cn(
          "absolute inset-x-0 top-2.5 h-6 rounded-[12px] transition-colors duration-100",
          checked ? "bg-secondary" : "bg-track",
        )}
      />
      <span
        aria-hidden="true"
        className={cn(
          "absolute top-[5px] h-[34px] w-8 rounded-[10px] border-2 border-b-4 bg-page transition-[left] duration-200",
          checked ? "left-[25px] border-secondary" : "left-0 border-line",
        )}
      />
    </button>
  );
}
