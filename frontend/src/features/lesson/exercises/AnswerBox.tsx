"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import type { TextLang } from "@/lib/api/types";
import { cn } from "@/lib/cn";

/** The server accepts typed answers of 1–200 characters. */
const MAX_ANSWER_LENGTH = 200;

const PLACEHOLDERS: Record<TextLang, string> = { es: "Type in Spanish", en: "Type in English" };

interface AnswerBoxProps {
  value: string;
  onChange(text: string): void;
  language: TextLang;
  /** Keys for letters an English keyboard lacks (á é í ó ú ñ ü ¿ ¡); empty for English answers. */
  specialCharacters: string[];
  locked: boolean;
  className?: string;
}

/**
 * The typed answer: a grey textarea that takes focus when it appears, with the special-character keys under
 * it. Enter checks the answer (the lesson keyboard handles it) and Shift+Enter starts a new line.
 */
export function AnswerBox({ value, onChange, language, specialCharacters, locked, className }: AnswerBoxProps) {
  const field = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // Phones would pop their keyboard over the exercise; they focus on the first tap instead. A locked box
    // leaves the focus where it is: on CONTINUE once the answer is checked.
    if (!locked && window.matchMedia("(pointer: fine)").matches) field.current?.focus({ preventScroll: true });
  }, [locked]);

  function insert(character: string) {
    const element = field.current;
    if (!element || locked) return;
    const start = element.selectionStart;
    const end = element.selectionEnd;
    onChange(`${value.slice(0, start)}${character}${value.slice(end)}`.slice(0, MAX_ANSWER_LENGTH));
    // Put the caret after the inserted letter once React has written the new value.
    requestAnimationFrame(() => {
      element.focus();
      element.setSelectionRange(start + character.length, start + character.length);
    });
  }

  return (
    <div className={className}>
      <textarea
        ref={field}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        readOnly={locked}
        lang={language}
        placeholder={PLACEHOLDERS[language]}
        aria-label={PLACEHOLDERS[language]}
        maxLength={MAX_ANSWER_LENGTH}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        className={cn(
          "block min-h-[120px] w-full resize-none rounded-md border-2 border-line bg-subtle px-3 py-2.5 md:min-h-40",
          "text-[19px] leading-[1.4] font-semibold text-fg outline-none placeholder:text-fg-3 focus:border-line-selected",
        )}
      />
      {specialCharacters.length > 0 && <SpecialCharacters characters={specialCharacters} locked={locked} onInsert={insert} />}
    </div>
  );
}

interface SpecialCharactersProps {
  characters: string[];
  /** After CHECK the keys stay in view but no longer respond. */
  locked: boolean;
  onInsert(character: string): void;
}

/** One key per special letter. Holding Shift shows (and types) the capitals. */
function SpecialCharacters({ characters, locked, onInsert }: SpecialCharactersProps) {
  const [shift, setShift] = useState(false);

  useEffect(() => {
    const track = (event: KeyboardEvent) => setShift(event.shiftKey);
    const release = () => setShift(false);
    window.addEventListener("keydown", track);
    window.addEventListener("keyup", track);
    window.addEventListener("blur", release);
    return () => {
      window.removeEventListener("keydown", track);
      window.removeEventListener("keyup", track);
      window.removeEventListener("blur", release);
    };
  }, []);

  return (
    <div inert={locked} className="mt-3 flex flex-wrap gap-2">
      {characters.map((character) => {
        const shown = shift ? character.toLocaleUpperCase("es") : character;
        return (
          <Button
            key={character}
            variant="outline-ink"
            size="key"
            aria-label={`Type ${shown}`}
            // Keeps the focus (and the caret) in the answer box.
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onInsert(shown)}
          >
            {shown}
          </Button>
        );
      })}
    </div>
  );
}
