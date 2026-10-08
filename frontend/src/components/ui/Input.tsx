import { useId, type ComponentProps } from "react";
import { cn } from "@/lib/cn";

export interface InputProps extends ComponentProps<"input"> {
  /** Shown under the field in red; also marks the field invalid for screen readers. */
  error?: string;
}

/**
 * A single-line text field on the subtle surface. The border turns blue on focus and red on error. The
 * `className` styles the wrapper (width, margins); the field fills it.
 */
export function Input({ error, className, id, "aria-describedby": describedBy, ...rest }: InputProps) {
  const generatedId = useId();
  const errorId = `${id ?? generatedId}-error`;
  const describedByIds = [describedBy, error && errorId].filter(Boolean).join(" ");
  return (
    <div className={className}>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedByIds || undefined}
        className={cn(
          "h-[50px] w-full rounded-md border-2 bg-subtle px-3.5 py-[9.5px] text-body text-fg outline-none",
          "placeholder:text-fg-3 read-only:cursor-default disabled:cursor-default disabled:opacity-60",
          error ? "border-wrong-fg" : "border-line focus:border-line-selected",
        )}
        {...rest}
      />
      {error && (
        <p id={errorId} className="mt-2 text-small text-wrong-fg">
          {error}
        </p>
      )}
    </div>
  );
}
