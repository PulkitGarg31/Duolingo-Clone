import { SpeakerIcon } from "@/components/icons/SpeakerIcon";
import { TurtleIcon } from "@/components/icons/TurtleIcon";
import { Button } from "@/components/ui/Button";
import type { ExerciseAudio } from "./types";

/** The small blue speaker at the start of a speech bubble. */
export function InlineSpeaker({ audio }: { audio: ExerciseAudio }) {
  if (!audio.available) return null;
  return (
    <button
      type="button"
      aria-label="Play audio"
      onClick={() => audio.play()}
      className="mr-2 -ml-0.5 inline-grid size-7 shrink-0 cursor-pointer place-items-center rounded-sm align-[-6px] text-macaw hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
    >
      <SpeakerIcon size={24} playing={audio.playing} />
    </button>
  );
}

/** The 48 px speaker button beside a prompt sentence. */
export function SmallSpeaker({ audio }: { audio: ExerciseAudio }) {
  if (!audio.available) return null;
  return (
    <Button variant="secondary" size="speaker-sm" aria-label="Play audio" onClick={() => audio.play()}>
      <SpeakerIcon playing={audio.playing} />
    </Button>
  );
}

/** The listening exercise's big speaker and the turtle that replays slowly. */
export function ListenSpeakers({ audio }: { audio: ExerciseAudio }) {
  if (!audio.available) return null;
  return (
    <div className="mt-2 mb-6 flex items-center justify-center gap-6">
      <Button variant="secondary" size="speaker-xl" aria-label="Play audio" onClick={() => audio.play()}>
        <SpeakerIcon playing={audio.playing} />
      </Button>
      <Button variant="secondary" size="speaker-slow" aria-label="Play audio slowly" onClick={() => audio.play(true)}>
        <TurtleIcon />
      </Button>
    </div>
  );
}
