import type { ComponentType } from "react";
import type { IconProps } from "@/components/icons/Icon";
import { RefreshIcon } from "@/components/icons/RefreshIcon";
import { SparkleIcon } from "@/components/icons/SparkleIcon";
import type { ItemLabel } from "@/lib/api/types";
import { cn } from "@/lib/cn";

interface LabelStyle {
  text: string;
  Icon: ComponentType<IconProps>;
  /** The circle behind the white glyph. */
  circle: string;
  /** The label's text colour, the same hue. */
  ink: string;
}

const LABELS: Record<ItemLabel, LabelStyle> = {
  new_word: { text: "New word", Icon: SparkleIcon, circle: "bg-beetle", ink: "text-beetle" },
  previous_mistake: { text: "Previous mistake", Icon: RefreshIcon, circle: "bg-fox", ink: "text-fox" },
};

/** NEW WORD (purple sparkle) or PREVIOUS MISTAKE (orange arrows) above the instruction. */
export function ExerciseLabel({ label }: { label: ItemLabel }) {
  const { text, Icon, circle, ink } = LABELS[label];
  return (
    <p className={cn("mb-2 flex items-center gap-2", ink)}>
      <span className={cn("grid size-6 place-items-center rounded-full text-on-color-fixed", circle)}>
        <Icon size={16} />
      </span>
      <span className="text-label uppercase">{text}</span>
    </p>
  );
}
