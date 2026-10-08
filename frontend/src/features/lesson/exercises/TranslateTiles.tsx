"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import type { TokenOut, TranslateExercise } from "@/lib/api/types";
import {
  tileIdsOf,
  withKeyboardText,
  withTile,
  withTranslateMode,
  withoutTile,
} from "@/lib/lesson/answerDraft";
import { useExerciseKeys } from "../keyboard/LessonKeyboard";
import { AnswerBox } from "./AnswerBox";
import { PromptBubble } from "./PromptBubble";
import type { ExerciseViewProps } from "./types";
import { GhostSlot, WordToken } from "./WordToken";

/** 2 px rules every 60 px: the lines the answer tokens sit on. */
const ANSWER_LINES = "repeating-linear-gradient(to bottom, transparent 0 58px, var(--c-line) 58px 60px)";

interface TranslateTilesProps extends ExerciseViewProps<TranslateExercise> {
  /** USE KEYBOARD is hidden in Timed practice, which only uses fast exercises. */
  allowKeyboard?: boolean;
}

/**
 * "Write this in English": the speaker says the sentence; the learner taps word tokens from the bank onto the
 * answer lines (a used token leaves a grey slot behind) or switches to the keyboard and types it.
 */
export function TranslateTiles({
  exercise,
  draft,
  onDraft,
  locked,
  hintsEnabled,
  onTap,
  audio,
  allowKeyboard = true,
}: TranslateTilesProps) {
  const mode = draft?.type === "translate" ? draft.mode : "tiles";
  const answerIds = tileIdsOf(draft);
  // The token that moved last flies above its neighbours.
  const [lastMoved, setLastMoved] = useState<number | null>(null);

  function move(tile: TokenOut) {
    if (locked) return;
    const inAnswer = answerIds.includes(tile.id);
    onTap();
    if (!inAnswer && exercise.answerLanguage === "es") audio.speak(tile.text);
    setLastMoved(tile.id);
    onDraft(inAnswer ? withoutTile(draft, tile.id) : withTile(draft, tile.id));
  }

  useExerciseKeys({
    mode: mode === "keyboard" ? "typing" : "tiles",
    onKey: (action) => {
      const tile =
        action.type === "choose"
          ? exercise.tiles[action.index]
          : exercise.tiles.find((candidate) => candidate.id === answerIds.at(-1));
      if (tile) move(tile);
    },
  });

  const tileText = (id: number) => exercise.tiles.find((tile) => tile.id === id)?.text ?? "";

  return (
    <div className="grid">
      <PromptBubble exerciseId={exercise.id} prompt={exercise.prompt} audio={audio} hintsEnabled={hintsEnabled} onLine={mode === "tiles"} />
      {mode === "tiles" ? (
        <>
          <AnswerArea>
            {answerIds.map((id) => (
              <WordToken key={id} layoutId={`tile-${id}`} raised={id === lastMoved} disabled={locked} onClick={() => move({ id, text: tileText(id) })}>
                {tileText(id)}
              </WordToken>
            ))}
          </AnswerArea>
          <div className="mt-6 flex flex-wrap justify-center gap-2 md:mt-8">
            {exercise.tiles.map((tile, index) => (
              <div key={tile.id} className="relative">
                <GhostSlot>{tile.text}</GhostSlot>
                {!answerIds.includes(tile.id) && (
                  <WordToken
                    fill
                    layoutId={`tile-${tile.id}`}
                    raised={tile.id === lastMoved}
                    disabled={locked}
                    shortcut={index < 10 ? String((index + 1) % 10) : undefined}
                    onClick={() => move(tile)}
                  >
                    {tile.text}
                  </WordToken>
                )}
              </div>
            ))}
          </div>
        </>
      ) : (
        <AnswerBox
          className="mt-6"
          value={draft?.type === "translate" && draft.mode === "keyboard" ? draft.text : ""}
          onChange={(text) => onDraft(withKeyboardText("translate", text))}
          language={exercise.answerLanguage}
          specialCharacters={exercise.specialCharacters}
          locked={locked}
        />
      )}
      {allowKeyboard && (
        <Button
          variant="ghost"
          size="sm"
          inert={locked}
          className="mt-4 justify-self-start md:mt-6"
          onClick={() => onDraft(withTranslateMode(draft, mode === "tiles" ? "keyboard" : "tiles"))}
        >
          {mode === "tiles" ? "Use keyboard" : "Use word bank"}
        </Button>
      )}
    </div>
  );
}

/**
 * The ruled area the answer tokens sit on. Token height + row gap is 60 px and the paddings add up to the
 * last gap, so the area always ends on a line: a third line appears when the answer wraps to a third row.
 */
function AnswerArea({ children }: { children: ReactNode }) {
  return (
    <div
      className="flex min-h-[120px] flex-wrap content-start gap-x-1.5 gap-y-4 pt-2 pb-2 md:gap-y-2.5 md:pt-0.5"
      style={{ backgroundImage: ANSWER_LINES }}
    >
      {children}
    </div>
  );
}
