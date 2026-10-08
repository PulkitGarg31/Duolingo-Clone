"use client";

import { Illustration } from "@/components/illustrations/Illustration";
import { CardButton } from "@/components/ui/Card";
import { HotkeyBadge } from "@/components/ui/HotkeyBadge";
import type { ChoiceOptionOut, MultipleChoiceExercise } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { withOption } from "@/lib/lesson/answerDraft";
import { ANSWER_CHOICE, useExerciseKeys } from "../keyboard/LessonKeyboard";
import type { ExerciseViewProps } from "./types";

/**
 * "Which one of these is “the juice”?": three picture cards in a row (two by two for four), each with its
 * Spanish label. Picking a card speaks its word.
 */
export function ImageChoiceGrid({ exercise, draft, onDraft, locked, onTap, audio }: ExerciseViewProps<MultipleChoiceExercise>) {
  const selectedId = draft?.type === "multiple_choice" ? draft.optionId : null;

  function pick(option: ChoiceOptionOut) {
    if (locked) return;
    onTap();
    audio.speak(option.text);
    onDraft(withOption("multiple_choice", option.id));
  }

  useExerciseKeys({
    mode: "choices",
    onKey: (action) => {
      const option = action.type === "choose" ? exercise.options[action.index] : undefined;
      if (option) pick(option);
    },
  });

  return (
    <div
      role="radiogroup"
      aria-label={exercise.instruction}
      className={cn("grid gap-3 sm:gap-4", exercise.options.length === 4 ? "grid-cols-2" : "grid-cols-3")}
    >
      {exercise.options.map((option, index) => {
        const selected = option.id === selectedId;
        return (
          <CardButton
            key={option.id}
            {...ANSWER_CHOICE}
            role="radio"
            aria-checked={selected}
            aria-keyshortcuts={String(index + 1)}
            selected={selected}
            tile
            padding="none"
            disabled={locked}
            onClick={() => pick(option)}
            className="flex aspect-[3/4] w-full flex-col items-center justify-between px-3 pt-4 pb-3 md:pb-4"
          >
            <HotkeyBadge tone={selected ? "selected" : "idle"} className="absolute top-2.5 left-2.5">
              {index + 1}
            </HotkeyBadge>
            <span className="flex w-full flex-1 items-center justify-center">
              {option.imageKey && <Illustration name={option.imageKey} className="h-auto w-[72%]" />}
            </span>
            <span className="text-center text-[17px] leading-[1.15] font-semibold md:text-[19px]">{option.text}</span>
          </CardButton>
        );
      })}
    </div>
  );
}
