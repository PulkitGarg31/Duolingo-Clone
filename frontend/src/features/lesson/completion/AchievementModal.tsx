"use client";

import { useRef, useState } from "react";
import { AchievementBadge } from "@/components/icons";
import { Confetti } from "@/components/mascot";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import type { AchievementUnlockOut } from "@/lib/api/types";
import { achievementCopy, COMPLETION_COPY } from "@/lib/lesson/copy";
import { useSoundOnce } from "./celebrationSound";
import styles from "./completion.module.css";
import { Rays } from "./Rays";

interface AchievementModalProps {
  achievement: AchievementUnlockOut;
  /** CONTINUE, Esc and a click outside all move the sequence on. */
  onContinue: () => void;
}

/**
 * "Wildfire unlocked!": the level's badge tile drops in over turning rays, with a confetti burst once it
 * lands. It opens over the screen before it, like Duolingo's achievement pop-ups.
 */
export function AchievementModal({ achievement, onContinue }: AchievementModalProps) {
  const tile = useRef<HTMLDivElement>(null);
  const [landed, setLanded] = useState(false);
  const copy = achievementCopy(achievement);
  useSoundOnce("achievement");

  return (
    <>
      <Modal
        open
        onOpenChange={(open) => {
          if (!open) onContinue();
        }}
        size="sm"
        title={copy.title}
        description={copy.body}
        illustration={
          <div className="relative grid size-[200px] place-items-center">
            <Rays color="color-mix(in srgb, var(--duo-bee) 15%, transparent)" optional className="absolute inset-0" />
            <div ref={tile} className={styles.drop} onAnimationEnd={() => setLanded(true)}>
              <AchievementBadge code={achievement.code} level={achievement.level} variant="modal" size={120} />
            </div>
          </div>
        }
        actions={
          <>
            <Button onClick={onContinue}>{COMPLETION_COPY.continue}</Button>
            <ButtonLink href="/profile#achievements" replace variant="ghost">
              {COMPLETION_COPY.viewAchievements}
            </ButtonLink>
          </>
        }
      />
      {/* Outside the dialog panel, whose pop-in transform would otherwise pin the full-screen canvas to it. */}
      {landed && <Confetti variant="burst" origin={tile} />}
    </>
  );
}
