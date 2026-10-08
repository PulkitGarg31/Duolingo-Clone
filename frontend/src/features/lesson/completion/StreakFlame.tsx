import { FlameIcon } from "@/components/icons";
import { cn } from "@/lib/cn";
import styles from "./completion.module.css";

/**
 * The big streak flame on a breathing glow. It ignites on arrival (grows past its size while its grey turns
 * orange), and once `lit` it flickers from its base for as long as the screen is up.
 */
export function StreakFlame({ lit }: { lit: boolean }) {
  return (
    <div className="relative grid size-40 place-items-center">
      <div className={cn("absolute -inset-10", styles.glow)} />
      <div
        className={cn(
          "relative origin-bottom",
          lit ? "animate-flame" : "animate-[flame-ignite_600ms_var(--ease-spring)_both]",
        )}
      >
        <FlameIcon size={160} />
      </div>
    </div>
  );
}
