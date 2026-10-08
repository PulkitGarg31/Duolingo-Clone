"use client";

import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends Omit<ComponentProps<"select">, "value" | "onChange" | "children"> {
  value: string;
  options: readonly SelectOption[];
  onValueChange: (value: string) => void;
}

/**
 * An outline-style picker. The visible box only shows the current choice; an invisible native `<select>`
 * covers it and does the work, so keyboard use, screen readers and the phone's own picker all behave natively.
 */
export function Select({ value, options, onValueChange, disabled, className, ...rest }: SelectProps) {
  const current = options.find((option) => option.value === value);
  return (
    <div
      className={cn(
        "relative flex h-[50px] items-center rounded-md border-2 border-line bg-page pr-[41px] pl-3 shadow-[0_2px_0_var(--c-line)]",
        "text-[15px] leading-[18px] font-extrabold tracking-[0.8px] text-fg-2 uppercase",
        "has-focus-visible:outline-2 has-focus-visible:outline-offset-4 has-focus-visible:outline-focus",
        disabled ? "opacity-60" : "hover:brightness-95",
        className,
      )}
    >
      <span className="truncate">{current?.label}</span>
      <svg
        aria-hidden="true"
        width={15}
        height={9}
        viewBox="0 0 15 9"
        fill="none"
        className="pointer-events-none absolute right-4 stroke-fg-3"
      >
        <path d="M1.5 1.5 7.5 7.5 13.5 1.5" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onValueChange(event.target.value)}
        className="absolute inset-0 size-full cursor-pointer appearance-none opacity-0 disabled:cursor-default"
        {...rest}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
