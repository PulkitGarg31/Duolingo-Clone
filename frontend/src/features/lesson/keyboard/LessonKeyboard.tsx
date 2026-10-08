"use client";

import {
  createContext,
  useContext,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  type ReactNode,
  type RefObject,
} from "react";
import { keyToAction, type HotkeyAction, type HotkeyMode } from "@/lib/hotkeys";

/** Number keys and Backspace act on the exercise; the screen handles Enter, Esc and replay. */
export type ExerciseKeyAction = Extract<HotkeyAction, { type: "choose" | "removeLast" }>;

export interface ExerciseKeys {
  mode: Extract<HotkeyMode, "choices" | "tiles" | "match" | "typing">;
  onKey?(action: ExerciseKeyAction): void;
}

/** What the screen shows: an exercise (its view sets the mode), a CONTINUE-only screen, celebrations, or nothing. */
export type KeyboardScreen = "exercise" | "continue" | "celebration" | "none";

interface Registry {
  /** Makes these keys the active exercise's; returns the function that unregisters them. */
  register(keys: RefObject<ExerciseKeys>): () => void;
}

const RegistryContext = createContext<Registry | null>(null);

/**
 * Marks an answer choice (a card, an option, a word tile, a match tile). Enter on a focused choice still
 * means CHECK; on any other focused button or link it activates that control.
 */
export const ANSWER_CHOICE = { "data-answer-choice": "" } as const;

interface LessonKeyboardProps {
  screen: KeyboardScreen;
  onPrimary(): void;
  onQuit(): void;
  onReplay(slow: boolean): void;
  children: ReactNode;
}

/**
 * One keydown listener for the whole player. It turns keys into actions with the pure `keyToAction` and
 * hands exercise keys to the exercise view on screen, which registers with `useExerciseKeys`.
 */
export function LessonKeyboard({ screen, onPrimary, onQuit, onReplay, children }: LessonKeyboardProps) {
  const active = useRef<RefObject<ExerciseKeys> | null>(null);
  const registry = useMemo<Registry>(
    () => ({
      register(keys) {
        active.current = keys;
        return () => {
          if (active.current === keys) active.current = null;
        };
      },
    }),
    [],
  );

  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    // A held key would fire CHECK, CONTINUE and the next CHECK in a row.
    if (event.repeat || event.isComposing || event.defaultPrevented) return;
    const exercise = active.current?.current ?? null;
    const mode: HotkeyMode = screen === "exercise" ? (exercise?.mode ?? "none") : screen;
    const action = keyToAction(
      event.key,
      { ctrl: event.ctrlKey, shift: event.shiftKey, alt: event.altKey, meta: event.metaKey },
      { mode, inTextField: isTextField(event.target), onControl: ownsEnter(event.target) },
    );
    if (!action) return;
    // Stops the focused element from also reacting (a focused tile would otherwise move on Enter).
    event.preventDefault();
    switch (action.type) {
      case "primary":
        onPrimary();
        break;
      case "quit":
        onQuit();
        break;
      case "replay":
        onReplay(action.slow);
        break;
      case "choose":
      case "removeLast":
        exercise?.onKey?.(action);
        break;
    }
  });

  useEffect(() => {
    const listener = (event: KeyboardEvent) => onKeyDown(event);
    document.addEventListener("keydown", listener);
    return () => document.removeEventListener("keydown", listener);
  }, []);

  return <RegistryContext.Provider value={registry}>{children}</RegistryContext.Provider>;
}

/** Declares the exercise's keyboard mode and receives its number keys and Backspace. */
export function useExerciseKeys(keys: ExerciseKeys): void {
  const registry = useContext(RegistryContext);
  const latest = useRef(keys);
  useEffect(() => {
    latest.current = keys;
  });
  useEffect(() => registry?.register(latest), [registry]);
}

function isTextField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target instanceof HTMLTextAreaElement || target.isContentEditable) return true;
  return target instanceof HTMLInputElement && !["checkbox", "radio", "button", "submit"].includes(target.type);
}

/** A focused button or link handles Enter itself, unless it is an answer choice. */
function ownsEnter(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return target.closest("button, a[href], [role='button']") !== null && target.closest("[data-answer-choice]") === null;
}
