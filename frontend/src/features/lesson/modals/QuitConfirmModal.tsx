"use client";

import { Owl } from "@/components/mascot/Owl";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

interface QuitConfirmModalProps {
  open: boolean;
  /** END SESSION was pressed and the quit request is on its way. */
  quitting: boolean;
  onKeepLearning(): void;
  onEndSession(): void;
}

/** "Wait, don't go!": KEEP LEARNING closes it (as do Esc and the scrim); END SESSION ends the lesson. */
export function QuitConfirmModal({ open, quitting, onKeepLearning, onEndSession }: QuitConfirmModalProps) {
  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (!next && !quitting) onKeepLearning();
      }}
      illustration={<Owl pose="sad" size={120} />}
      title={<span className="mx-auto block max-w-[360px]">Wait, don&apos;t go! You&apos;ll lose your progress if you quit now</span>}
      actions={
        <>
          <Button variant="secondary" fullWidth autoFocus disabled={quitting} onClick={onKeepLearning}>
            Keep learning
          </Button>
          <Button variant="ghost-danger" fullWidth loading={quitting} onClick={onEndSession}>
            End session
          </Button>
        </>
      }
    />
  );
}
