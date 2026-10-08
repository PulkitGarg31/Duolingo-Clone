"use client";

import { useEffect } from "react";
import { SpeakerIcon } from "@/components/icons";
import { Button } from "@/components/ui";
import type { GuidebookOut } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { cancelSpeech, speak, useSpeech } from "@/lib/tts";

interface KeyPhrasesProps {
  phrases: GuidebookOut["keyPhrases"];
  /** The course's speech locale, e.g. "es-ES". */
  locale: string;
}

/**
 * The unit's key phrases, each with a speaker that reads it aloud. Devices without a voice for the course
 * language get no speakers. Speech stops when the learner leaves the page.
 */
export function KeyPhrases({ phrases, locale }: KeyPhrasesProps) {
  const speech = useSpeech(locale);
  const canSpeak = speech.status !== "unavailable";
  const language = locale.split("-")[0];

  useEffect(() => () => cancelSpeech(), []);

  return (
    <section aria-labelledby="key-phrases-title" className="mt-10">
      <h2 id="key-phrases-title" className="text-label text-fg-3 uppercase">
        Key phrases
      </h2>
      <ul className="mt-4 space-y-3">
        {phrases.map(({ text, translation }) => (
          <li
            key={text}
            className={cn("grid items-center gap-4 rounded-lg border-2 border-line p-4", canSpeak && "grid-cols-[48px_1fr]")}
          >
            {canSpeak && (
              <Button variant="secondary" size="speaker-sm" aria-label={`Listen: ${text}`} onClick={() => speak(text)}>
                <SpeakerIcon playing={speech.speaking === text} />
              </Button>
            )}
            <div className="min-w-0">
              <p lang={language} className="text-card-title text-fg-strong">
                {text}
              </p>
              <p className="mt-0.5 text-body text-fg-2">{translation}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
