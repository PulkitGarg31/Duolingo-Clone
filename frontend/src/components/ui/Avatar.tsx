import { cn } from "@/lib/cn";

/** 32 nav · 40 · 48 leaderboard rows · 56 · 128 profile. */
export type AvatarSize = 32 | 40 | 48 | 56 | 128;

interface AvatarProps {
  name: string;
  /**
   * The user's `avatarColor` from the API, which draws it from a fixed palette. Never derive one on the
   * client, or the profile and the leaderboard could disagree. Leave it out for the dashed placeholder.
   */
  color?: string | null;
  size?: AvatarSize;
  className?: string;
}

/**
 * A coloured circle with the user's initials. Decorative: the name it stands for is always written next to
 * it, or in its control's label.
 */
export function Avatar({ name, color, size = 48, className }: AvatarProps) {
  const box = { width: size, height: size, fontSize: Math.round(size * 0.4) };
  if (!color) {
    return (
      <span
        aria-hidden="true"
        className={cn(
          "inline-grid shrink-0 place-items-center rounded-full border-2 border-dashed border-fg-3 leading-none font-black text-fg-3",
          className,
        )}
        style={box}
      >
        {initials(name, 1)}
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-grid shrink-0 place-items-center rounded-full leading-none font-extrabold text-on-color-fixed",
        className,
      )}
      style={{ ...box, backgroundColor: color }}
    >
      {initials(name, 2)}
    </span>
  );
}

/** First letter of the first word, plus the last word's when `max` allows: "Ana Pérez" → "AP". */
function initials(name: string, max: 1 | 2): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const picked = max === 2 && words.length > 1 ? [words[0], words[words.length - 1]] : words.slice(0, 1);
  // Array.from splits by code point, so a name starting with an emoji or an astral letter stays whole.
  return picked.map((word) => Array.from(word)[0]).join("").toLocaleUpperCase();
}
