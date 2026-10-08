import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

interface SpeechBubbleProps {
  children: ReactNode;
  /** Where the speaker is: the tail points left (speaker beside the bubble) or down (speaker below it). */
  tail?: "left" | "bottom" | "none";
  /** "md" for prompt sentences, "lg" for the owl's coaching messages. */
  size?: "md" | "lg";
  className?: string;
}

/**
 * The bubble a speaker talks in: a 2 px outlined card with a tail that keeps the outline. The tail is a small
 * rotated square straddling the border: its two outer sides carry the border, and its fill hides the bubble's
 * own border where the two meet.
 */
export function SpeechBubble({ children, tail = "left", size = "md", className }: SpeechBubbleProps) {
  return (
    <div
      className={cn(
        "relative rounded-[14px] border-2 border-line bg-page text-fg",
        size === "md" ? "px-3 py-2.5" : "px-5 py-4",
        className,
      )}
    >
      {children}
      {tail === "left" && (
        <span aria-hidden="true" className="absolute bottom-[21px] -left-[9px] size-4 rotate-45 border-b-2 border-l-2 border-line bg-page" />
      )}
      {tail === "bottom" && (
        <span aria-hidden="true" className="absolute -bottom-[9px] left-8 size-4 rotate-45 border-r-2 border-b-2 border-line bg-page" />
      )}
    </div>
  );
}
