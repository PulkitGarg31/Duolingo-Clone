"use client";

import type { FillBlankExercise, TokenOut } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { withOption } from "@/lib/lesson/answerDraft";
import { useExerciseKeys } from "../keyboard/LessonKeyboard";
import { HintedText } from "./HintedText";
import type { ExerciseViewProps } from "./types";
import { GhostSlot, WordToken } from "./WordToken";

/**
 * "Fill in the blank": a Spanish sentence with one gap and its English meaning under it. Tapping a choice
 * flies it into the gap (leaving a grey slot behind); tapping it there sends it back.
 */
export function FillBlank({ exercise, draft, onDraft, locked, hintsEnabled, onTap, audio }: ExerciseViewProps<FillBlankExercise>) {
  const chosenId = draft?.type === "fill_blank" ? draft.optionId : null;
  const chosen = exercise.options.find((option) => option.id === chosenId) ?? null;
  // The gap is as wide as the longest choice, so filling it never reflows the sentence much.
  const longest = Math.max(...exercise.options.map((option) => option.text.length));

  function press(option: TokenOut) {
    if (locked) return;
    onTap();
    if (option.id === chosenId) {
      onDraft(null);
      return;
    }
    audio.speak(option.text);
    onDraft(withOption("fill_blank", option.id));
  }

  useExerciseKeys({
    mode: "tiles",
    onKey: (action) => {
      const option = action.type === "choose" ? exercise.options[action.index] : chosen;
      if (option) press(option);
    },
  });

  const blank = (
    <span
      className={cn(
        // Baseline-aligned: empty, its underline sits on the line; filled, the token's text lines up with the sentence.
        "mx-1.5 inline-flex min-h-[1.2em] justify-center align-baseline",
        chosen ? "border-transparent" : "border-b-2 border-line",
      )}
      style={{ minWidth: `max(96px, calc(${longest}ch + 24px))` }}
    >
      {chosen && (
        <WordToken layoutId={`option-${chosen.id}`} raised disabled={locked} onClick={() => press(chosen)}>
          {chosen.text}
        </WordToken>
      )}
    </span>
  );

  return (
    <div className="grid">
      <p className="text-[19px] leading-[44px] font-semibold text-fg md:text-[24px] md:leading-[52px]">
        <HintedText prompt={exercise.prompt} hintsEnabled={hintsEnabled} onSpeak={audio.speak} blank={blank} />
      </p>
      {exercise.translation && <p className="mt-1 text-body text-fg-3 md:text-subtitle">{exercise.translation}</p>}
      <div className="mt-8 flex flex-wrap justify-center gap-2">
        {exercise.options.map((option, index) => (
          <div key={option.id} className="relative">
            <GhostSlot>{option.text}</GhostSlot>
            {option.id !== chosenId && (
              <WordToken fill layoutId={`option-${option.id}`} disabled={locked} shortcut={String(index + 1)} onClick={() => press(option)}>
                {option.text}
              </WordToken>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
