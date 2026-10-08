import { cn } from "@/lib/cn";

interface DividerProps {
  orientation?: "horizontal" | "vertical";
  className?: string;
}

/** A 2 px rule in the line colour (never 1 px). The vertical one stretches to its row's height. */
export function Divider({ orientation = "horizontal", className }: DividerProps) {
  if (orientation === "vertical") {
    return <div role="separator" aria-orientation="vertical" className={cn("w-0.5 shrink-0 self-stretch bg-line", className)} />;
  }
  return <hr className={cn("h-0.5 border-0 bg-line", className)} />;
}
