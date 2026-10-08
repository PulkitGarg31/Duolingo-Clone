import { BoltIcon, BookGlyph, FlameIcon, TargetIcon } from "@/components/icons";
import type { QuestIcon } from "@/lib/api/types";

/** A quest's picture, from the API's `icon`: XP, lessons, perfect lessons, or combos and streaks. */
export function QuestGlyph({ icon, size }: { icon: QuestIcon; size: number }) {
  switch (icon) {
    case "bolt":
      return <BoltIcon size={size} />;
    case "book":
      return <BookGlyph size={size} className="text-macaw" />;
    case "target":
      return <TargetIcon size={size} />;
    case "flame":
      return <FlameIcon size={size} />;
  }
}
