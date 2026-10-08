"use client";

import type { TypeAnswerExercise } from "@/lib/api/types";
import { withKeyboardText } from "@/lib/lesson/answerDraft";
import { useExerciseKeys } from "../keyboard/LessonKeyboard";
import { AnswerBox } from "./AnswerBox";
import { ListenSpeakers } from "./SpeakerButtons";
import type { ExerciseViewProps } from "./types";

interface ListenTypeProps extends ExerciseViewProps<TypeAnswerExercise> {
  /** CAN'T LISTEN NOW: skips every listening item of the lesson, with no penalty. */
  onCantListen(): void;
}

/**
 * "Type what you hear": a big speaker and a slow turtle play a sentence that is never shown; the learner
 * types it. The sentence plays once by itself when the exercise appears.
 */
export function ListenType({ exercise, draft, onDraft, locked, audio, onCantListen }: ListenTypeProps) {
  useExerciseKeys({ mode: "typing" });
  return (
    <div className="grid">
      <ListenSpeakers audio={audio} />
      <AnswerBox
        value={draft?.type === "type_answer" ? draft.text : ""}
        onChange={(text) => onDraft(withKeyboardText("type_answer", text))}
        language={exercise.answerLanguage}
        specialCharacters={exercise.specialCharacters}
        locked={locked}
      />
      <button
        type="button"
        inert={locked}
        onClick={onCantListen}
        className="mt-4 h-8 cursor-pointer justify-self-start rounded-sm px-2 text-[14px] leading-[1.2] font-extrabold tracking-[0.8px] text-fg-3 uppercase hover:text-fg-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus md:mt-6"
      >
        Can&apos;t listen now
      </button>
    </div>
  );
}
