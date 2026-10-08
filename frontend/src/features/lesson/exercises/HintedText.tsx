"use client";

import { Fragment, useState, type PointerEvent, type ReactNode } from "react";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/Popover";
import type { PromptOut } from "@/lib/api/types";
import { cn } from "@/lib/cn";

/** How a fill-in-the-blank sentence marks its gap. */
const BLANK_MARK = "___";

interface HintedTextProps {
  prompt: PromptOut;
  /** False in Legendary: no dotted words at all. */
  hintsEnabled: boolean;
  /** Speaks a tapped Spanish word. */
  onSpeak?(text: string): void;
  /** Draws the gap of a fill-in-the-blank sentence in place of its "___". */
  blank?: ReactNode;
}

/**
 * A prompt sentence whose glossary words carry a dotted underline. Hovering or tapping one shows its
 * meanings. The segments always add up to the sentence, so plain segments render as they are.
 */
export function HintedText({ prompt, hintsEnabled, onSpeak, blank }: HintedTextProps) {
  const segments = prompt.segments.length > 0 ? prompt.segments : [{ text: prompt.text, hint: null }];
  return (
    <>
      {segments.map((segment, index) =>
        segment.hint && hintsEnabled ? (
          <HintWord key={index} text={segment.text} hint={segment.hint} onSpeak={prompt.language === "es" ? onSpeak : undefined} />
        ) : (
          <Fragment key={index}>{withBlank(segment.text, blank)}</Fragment>
        ),
      )}
    </>
  );
}

function withBlank(text: string, blank: ReactNode): ReactNode {
  if (blank === undefined || !text.includes(BLANK_MARK)) return text;
  const [before, after] = text.split(BLANK_MARK);
  return (
    <>
      {before}
      {blank}
      {after}
    </>
  );
}

interface HintWordProps {
  text: string;
  /** Alternatives separated by ", ": "drink, I drink" is two rows. */
  hint: string;
  onSpeak?(text: string): void;
}

function HintWord({ text, hint, onSpeak }: HintWordProps) {
  const [open, setOpen] = useState(false);
  const meanings = hint.split(", ");

  function hover(event: PointerEvent, next: boolean) {
    if (event.pointerType === "mouse") setOpen(next);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <button
          type="button"
          aria-expanded={open}
          onPointerEnter={(event) => hover(event, true)}
          onPointerLeave={(event) => hover(event, false)}
          onClick={() => {
            setOpen(true);
            onSpeak?.(text);
          }}
          className="cursor-pointer rounded-sm underline decoration-fg-3 decoration-dotted decoration-2 underline-offset-[6px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          {text}
        </button>
      </PopoverAnchor>
      <PopoverContent side="bottom" autoFocus={false} offset={10} className="min-w-28">
        <ul aria-label={`Meanings of ${text}`}>
          {meanings.map((meaning, index) => (
            <li
              key={meaning}
              className={cn(
                "px-4 py-2 text-center text-body text-fg",
                index === 0 ? "font-extrabold" : "border-t-2 border-line",
              )}
            >
              {meaning}
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
