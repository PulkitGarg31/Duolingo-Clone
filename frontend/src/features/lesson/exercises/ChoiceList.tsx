"use client";

import { CardButton } from "@/components/ui/Card";
import { HotkeyBadge } from "@/components/ui/HotkeyBadge";
import type { ChoiceOptionOut, MultipleChoiceExercise, PromptOut } from "@/lib/api/types";
import { withOption } from "@/lib/lesson/answerDraft";
import { ANSWER_CHOICE, useExerciseKeys } from "../keyboard/LessonKeyboard";
import { HintedText } from "./HintedText";
import { SmallSpeaker } from "./SpeakerButtons";
import type { ExerciseAudio, ExerciseViewProps } from "./types";

/**
 * "Select the correct meaning": an optional prompt sentence over a list of text options. Options are Spanish
 * when the prompt is English or absent ("How do you say …?"), so only then does picking one speak it.
 */
export function ChoiceList({ exercise, draft, onDraft, locked, hintsEnabled, onTap, audio }: ExerciseViewProps<MultipleChoiceExercise>) {
  const selectedId = draft?.type === "multiple_choice" ? draft.optionId : null;
  const spanishOptions = exercise.prompt === null || exercise.prompt.language === "en";

  function pick(option: ChoiceOptionOut) {
    if (locked) return;
    onTap();
    if (spanishOptions) audio.speak(option.text);
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
    <div className="grid gap-4 md:gap-6">
      {exercise.prompt && <PromptLine prompt={exercise.prompt} audio={audio} hintsEnabled={hintsEnabled} />}
      <div role="radiogroup" aria-label={exercise.instruction} className="grid gap-2 md:gap-3">
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
              className="flex min-h-14 w-full items-center px-4 py-3 text-left [@media(hover:hover)_and_(pointer:fine)]:md:pl-[58px]"
            >
              <HotkeyBadge tone={selected ? "selected" : "idle"} className="absolute top-1/2 left-4 -translate-y-1/2">
                {index + 1}
              </HotkeyBadge>
              <span className="text-[17px] leading-[1.15] font-semibold md:text-[19px]">{option.text}</span>
            </CardButton>
          );
        })}
      </div>
    </div>
  );
}

interface PromptLineProps {
  prompt: PromptOut;
  audio: ExerciseAudio;
  hintsEnabled: boolean;
}

/** A prompt sentence beside its 48 px speaker button. */
export function PromptLine({ prompt, audio, hintsEnabled }: PromptLineProps) {
  return (
    <div className="flex items-center gap-4">
      {prompt.speak && <SmallSpeaker audio={audio} />}
      <p className="text-[19px] leading-[1.35] font-semibold text-fg md:text-[22px]">
        <HintedText prompt={prompt} hintsEnabled={hintsEnabled} onSpeak={audio.speak} />
      </p>
    </div>
  );
}
