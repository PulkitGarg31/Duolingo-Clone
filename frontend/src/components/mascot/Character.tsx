import { Kai } from "./characters/Kai";
import { Lucia } from "./characters/Lucia";
import { Marco } from "./characters/Marco";
import { Owl } from "./Owl";

/** The speakers of prompt bubbles, in the order exercises cycle through them. */
export const CHARACTERS = ["lucia", "marco", "kai", "owl"] as const;

export type CharacterId = (typeof CHARACTERS)[number];

interface CharacterProps {
  id: CharacterId;
  /** Height in px. */
  size?: number;
  /** Moves the speaker's mouth (or beak) while speech plays. */
  talking?: boolean;
  className?: string;
  /** Accessible name. Without one the speaker is decorative and hidden from assistive technology. */
  title?: string;
}

/** The owl's box keeps headroom above the tuft for its props, so it is drawn larger to stand as tall as people. */
const OWL_SCALE = 1.15;

/** One speaker: Lucía, Marco, Kai or the owl, standing on the bottom edge of its box. */
export function Character({ id, size = 120, ...props }: CharacterProps) {
  switch (id) {
    case "lucia":
      return <Lucia size={size} {...props} />;
    case "marco":
      return <Marco size={size} {...props} />;
    case "kai":
      return <Kai size={size} {...props} />;
    case "owl":
      return <Owl pose="idle" size={Math.round(size * OWL_SCALE)} {...props} />;
  }
}
