"use client";

import type { TypeAnswerExercise } from "@/lib/api/types";
import { withKeyboardText } from "@/lib/lesson/answerDraft";
import { useExerciseKeys } from "../keyboard/LessonKeyboard";
import { AnswerBox } from "./AnswerBox";
import { PromptBubble } from "./PromptBubble";
import type { ExerciseViewProps } from "./types";

/** "Write this in Spanish": the speaker says the sentence and the learner types the translation. */
export function TypeAnswer({ exercise, draft, onDraft, locked, hintsEnabled, audio }: ExerciseViewProps<TypeAnswerExercise>) {
  useExerciseKeys({ mode: "typing" });
  return (
    <div className="grid gap-6">
      <PromptBubble exerciseId={exercise.id} prompt={exercise.prompt} audio={audio} hintsEnabled={hintsEnabled} />
      <AnswerBox
        value={draft?.type === "type_answer" ? draft.text : ""}
        onChange={(text) => onDraft(withKeyboardText("type_answer", text))}
        language={exercise.answerLanguage}
        specialCharacters={exercise.specialCharacters}
        locked={locked}
      />
    </div>
  );
}
