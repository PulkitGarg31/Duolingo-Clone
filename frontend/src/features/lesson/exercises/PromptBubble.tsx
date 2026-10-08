import type { ReactNode } from "react";
import { CHARACTERS, Character, type CharacterId } from "@/components/mascot/Character";
import { SpeechBubble } from "@/components/mascot/SpeechBubble";
import type { PromptOut } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { HintedText } from "./HintedText";
import { InlineSpeaker } from "./SpeakerButtons";
import type { ExerciseAudio } from "./types";

/** Who says an exercise's prompt. Keyed by exercise id, so a retried exercise keeps its speaker. */
function speakerFor(exerciseId: number): CharacterId {
  return CHARACTERS[exerciseId % CHARACTERS.length];
}

interface PromptBubbleProps {
  exerciseId: number;
  prompt: PromptOut;
  audio: ExerciseAudio;
  hintsEnabled: boolean;
  /** Draws the first answer line under the speaker, who stands on it (the word bank's answer area). */
  onLine?: boolean;
  /** Replaces the sentence inside the bubble. */
  children?: ReactNode;
}

/**
 * A speaker (one of three people or the owl) saying the prompt in a speech bubble: the blue speaker button
 * when the sentence is Spanish, then the sentence with its dotted hint words.
 */
export function PromptBubble({ exerciseId, prompt, audio, hintsEnabled, onLine = false, children }: PromptBubbleProps) {
  const speaker = speakerFor(exerciseId);
  return (
    <div className={cn("flex items-end gap-1", onLine && "border-b-2 border-line")}>
      <Character
        id={speaker}
        talking={audio.playing}
        className={cn(
          "block w-auto shrink-0",
          speaker === "owl" ? "-mb-1 h-[112px] md:h-[138px]" : "h-24 md:h-[120px]",
        )}
      />
      <SpeechBubble tail="left" className="mb-6 ml-3 max-w-[80%] md:mb-9">
        <p className="text-[17px] leading-[1.4] font-semibold text-fg md:text-[19px]">
          {children ?? (
            <>
              {prompt.speak && <InlineSpeaker audio={audio} />}
              <HintedText prompt={prompt} hintsEnabled={hintsEnabled} onSpeak={audio.speak} />
            </>
          )}
        </p>
      </SpeechBubble>
    </div>
  );
}
