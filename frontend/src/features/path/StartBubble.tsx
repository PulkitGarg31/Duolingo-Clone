import { cn } from "@/lib/cn";

interface StartBubbleProps {
  /** "Start" on the current lesson, "Open" on a reachable chest. Uppercased by CSS. */
  label: string;
  /** Pops in, as when a node has just been unlocked. */
  pop?: boolean;
}

/**
 * The bobbing callout above the node to play next. The outer box is centred with a transform the bob keyframes
 * repeat, so it stays centred whether or not the bob runs (it stops under reduced motion). Its offset, height
 * and bob make up `BUBBLE_REACH`, the room the path leaves above the node that carries it.
 */
export function StartBubble({ label, pop = false }: StartBubbleProps) {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute bottom-[calc(100%+20px)] left-1/2 z-(--z-start) animate-start-bob [transform:translateX(-50%)]"
    >
      <span
        className={cn(
          "relative block min-w-20 rounded-[10px] border-2 border-line bg-page px-4 py-3 text-center",
          "text-[17px] leading-5 font-extrabold tracking-[.03em] whitespace-nowrap text-(--unit) uppercase",
          pop && "origin-bottom animate-pop-in",
        )}
      >
        {label}
        <span className="absolute -bottom-[9px] left-1/2 size-3.5 -translate-x-1/2 rotate-45 border-r-2 border-b-2 border-line bg-page" />
      </span>
    </span>
  );
}
