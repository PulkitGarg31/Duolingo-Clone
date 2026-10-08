"use client";

import { Owl } from "@/components/mascot/Owl";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

/** Every Legendary run costs this many gems, charged when it starts. */
const LEGENDARY_PRICE_GEMS = 100;

interface LegendaryFailedModalProps {
  open: boolean;
  /** The learner's gems, or null while unknown (the server still checks). */
  gems: number | null;
  restarting: boolean;
  onTryAgain(): void;
  onNoThanks(): void;
}

/** "Nice try!" after a third mistake ends a Legendary run: TRY AGAIN starts a new run for another 100 gems. */
export function LegendaryFailedModal({ open, gems, restarting, onTryAgain, onNoThanks }: LegendaryFailedModalProps) {
  const affordable = gems === null || gems >= LEGENDARY_PRICE_GEMS;
  return (
    <Modal
      open={open}
      onOpenChange={() => undefined}
      dismissible={false}
      illustration={<Owl pose="sad" size={140} />}
      title="Nice try!"
      description="That was tough. Keep practicing!"
      actions={
        <>
          <Button variant="gold" fullWidth disabled={!affordable} loading={restarting} onClick={onTryAgain}>
            Try again
          </Button>
          {!affordable && <p className="text-center text-small font-extrabold text-fg-3">Not enough gems</p>}
          <Button variant="ghost" fullWidth disabled={restarting} onClick={onNoThanks}>
            No thanks
          </Button>
        </>
      }
    >
      <p className="text-center text-small text-fg-2">Try again with fewer mistakes to get closer to Legendary</p>
    </Modal>
  );
}
