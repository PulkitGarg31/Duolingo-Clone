"use client";

import type { ExerciseOut } from "@/lib/api/types";
import { ChoiceList } from "./ChoiceList";
import { FillBlank } from "./FillBlank";
import { ImageChoiceGrid } from "./ImageChoiceGrid";
import { ListenType } from "./ListenType";
import { MatchPairs } from "./MatchPairs";
import { TranslateTiles } from "./TranslateTiles";
import { TypeAnswer } from "./TypeAnswer";
import type { ExerciseViewProps } from "./types";

interface ExerciseViewSwitchProps extends ExerciseViewProps<ExerciseOut> {
  /** USE KEYBOARD is offered (not in Timed practice). */
  allowKeyboard: boolean;
  onCantListen(): void;
}

/** The view for each exercise type. The switch is exhaustive: a new type does not compile until it has a view. */
export function ExerciseView({ allowKeyboard, onCantListen, ...props }: ExerciseViewSwitchProps) {
  const { exercise } = props;
  switch (exercise.type) {
    case "multiple_choice":
      return exercise.layout === "pictures" ? (
        <ImageChoiceGrid {...props} exercise={exercise} />
      ) : (
        <ChoiceList {...props} exercise={exercise} />
      );
    case "translate":
      return <TranslateTiles {...props} exercise={exercise} allowKeyboard={allowKeyboard} />;
    case "match_pairs":
      return <MatchPairs {...props} exercise={exercise} />;
    case "fill_blank":
      return <FillBlank {...props} exercise={exercise} />;
    case "type_answer":
      return exercise.audioOnly ? (
        <ListenType {...props} exercise={exercise} onCantListen={onCantListen} />
      ) : (
        <TypeAnswer {...props} exercise={exercise} />
      );
    default:
      return assertNever(exercise);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled exercise: ${JSON.stringify(value)}`);
}
