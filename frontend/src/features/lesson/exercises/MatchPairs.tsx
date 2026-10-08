"use client";

import { useEffect, useState } from "react";
import { HotkeyBadge } from "@/components/ui/HotkeyBadge";
import type { MatchPairsExercise, TokenOut } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { withMatch, withMistake } from "@/lib/lesson/answerDraft";
import { ANSWER_CHOICE, useExerciseKeys } from "../keyboard/LessonKeyboard";
import styles from "./matchPairs.module.css";
import type { ExerciseViewProps } from "./types";

type Side = "left" | "right";

interface Pick {
  side: Side;
  id: number;
}

interface Miss {
  leftId: number;
  rightId: number;
  /** Restarts the flash when the same tiles miss twice in a row. */
  round: number;
}

/** How long a wrong pair flashes. */
const MISS_FLASH_MS = 800;
/** Keys 1–5 pick the Spanish column, 6–0 the English one. */
const COLUMN_SIZE = 5;

/**
 * "Tap the matching pairs": Spanish words on the left, English on the right, each column in its own order.
 * Two taps make a pair. Tiles of a right pair flash green and fade out; a wrong pair flashes red and only
 * counts towards the lesson's statistics (no heart is lost). The last pair submits the exercise.
 */
export function MatchPairs({ exercise, draft, onDraft, locked, onTap, audio, onAutoSubmit }: ExerciseViewProps<MatchPairsExercise>) {
  const matched = draft?.type === "match_pairs" ? draft.matched : [];
  const matchedIds = new Set(matched.map((pair) => pair.leftId));
  const [selected, setSelected] = useState<Pick | null>(null);
  const [miss, setMiss] = useState<Miss | null>(null);

  useEffect(() => {
    if (!miss) return;
    const timer = setTimeout(() => setMiss(null), MISS_FLASH_MS);
    return () => clearTimeout(timer);
  }, [miss]);

  function press(side: Side, token: TokenOut) {
    if (locked || matchedIds.has(token.id)) return;
    if (side === "left") audio.speak(token.text);
    if (!selected || selected.side === side) {
      onTap();
      // Tapping the selected tile again lets it go; tapping another one on the same side moves the selection.
      setSelected(selected?.side === side && selected.id === token.id ? null : { side, id: token.id });
      return;
    }
    const leftId = side === "left" ? token.id : selected.id;
    const rightId = side === "right" ? token.id : selected.id;
    setSelected(null);
    if (leftId !== rightId) {
      setMiss({ leftId, rightId, round: (miss?.round ?? 0) + 1 });
      onDraft(withMistake(draft));
      return;
    }
    const next = withMatch(draft, { leftId, rightId });
    onDraft(next);
    if (next.type === "match_pairs" && next.matched.length === exercise.left.length) onAutoSubmit?.();
  }

  useExerciseKeys({
    mode: "match",
    onKey: (action) => {
      if (action.type !== "choose") return;
      const side: Side = action.index < COLUMN_SIZE ? "left" : "right";
      const token = side === "left" ? exercise.left[action.index] : exercise.right[action.index - COLUMN_SIZE];
      if (token) press(side, token);
    },
  });

  function tileState(side: Side, id: number): TileState {
    if (matchedIds.has(id)) return "matched";
    if (miss && (side === "left" ? miss.leftId : miss.rightId) === id) return "wrong";
    return selected?.side === side && selected.id === id ? "selected" : "idle";
  }

  const rows = Math.max(exercise.left.length, exercise.right.length);
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 min-[350px]:gap-y-4">
      {Array.from({ length: rows }, (_, row) =>
        (["left", "right"] as const).map((side) => {
          const token = (side === "left" ? exercise.left : exercise.right)[row];
          if (!token) return <span key={`${side}-${row}`} />;
          const state = tileState(side, token.id);
          const hotkey = side === "left" ? row + 1 : (row + COLUMN_SIZE + 1) % 10;
          return (
            <MatchTile
              // A new key restarts the red flash for a repeated miss.
              key={`${side}-${token.id}-${state === "wrong" ? miss?.round : 0}`}
              text={token.text}
              hotkey={hotkey}
              state={state}
              locked={locked}
              onPress={() => press(side, token)}
            />
          );
        }),
      )}
    </div>
  );
}

type TileState = "idle" | "selected" | "matched" | "wrong";

const STATE_CLASSES: Record<TileState, string> = {
  idle: "border-line bg-page text-fg shadow-[0_2px_0_var(--c-line)] enabled:hover:bg-subtle",
  selected: "border-line-selected bg-selected text-fg-selected shadow-[0_2px_0_var(--c-line-selected)]",
  matched: cn("border-line bg-page text-fg-faint", styles.matched),
  wrong: cn("border-line bg-page text-fg", styles.wrong),
};

interface MatchTileProps {
  text: string;
  hotkey: number;
  state: TileState;
  locked: boolean;
  onPress(): void;
}

function MatchTile({ text, hotkey, state, locked, onPress }: MatchTileProps) {
  return (
    <button
      type="button"
      disabled={locked || state === "matched"}
      {...ANSWER_CHOICE}
      aria-pressed={state === "selected"}
      aria-keyshortcuts={String(hotkey)}
      onClick={onPress}
      className={cn(
        "pressable relative flex min-h-14 w-full max-w-[300px] cursor-pointer items-center justify-center justify-self-center rounded-md border-2 px-4 py-2 [--lip:2px]",
        "text-center text-[17px] leading-[1.15] font-semibold select-none [-webkit-tap-highlight-color:transparent] disabled:cursor-default md:text-[19px]",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
        "[@media(hover:hover)_and_(pointer:fine)]:md:px-[54px]",
        STATE_CLASSES[state],
      )}
    >
      <HotkeyBadge
        tone={state === "selected" ? "selected" : state === "idle" ? "idle" : "inherit"}
        className="absolute top-1/2 left-4 -translate-y-1/2"
      >
        {hotkey}
      </HotkeyBadge>
      {text}
    </button>
  );
}
