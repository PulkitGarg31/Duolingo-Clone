"use client";

import { motion } from "motion/react";
import { useState } from "react";
import { LeagueBadge } from "@/components/icons";
import { Confetti } from "@/components/mascot";
import { Button, Modal } from "@/components/ui";
import type { LeagueOutcome, LeagueResultOut } from "@/lib/api/types";
import { useAckLeagueResult } from "@/lib/queries/mutations";
import { useMe } from "@/lib/queries/hooks";

const OUTCOME_VERBS: Record<LeagueOutcome, string> = {
  promoted: "advanced to",
  stayed: "kept your position in",
  demoted: "dropped down to",
};

/** "You finished #6 and advanced to the Silver League". */
export function leagueResultTitle(result: LeagueResultOut): string {
  return `You finished #${result.finalRank} and ${OUTCOME_VERBS[result.outcome]} the ${result.newLeague.name} League`;
}

interface LeagueResultModalProps {
  /** The result to show; kept while the modal closes. */
  result: LeagueResultOut | null;
  open: boolean;
  /** Acknowledges the result: CONTINUE, Esc or a click outside. */
  onContinue: () => void;
}

/** Last week's league result: the new league's badge pops in over turning gold rays, with confetti for a promotion. */
export function LeagueResultModal({ result, open, onContinue }: LeagueResultModalProps) {
  if (!result) return null;
  return (
    <>
      <Modal
        open={open}
        onOpenChange={(next) => {
          if (!next) onContinue();
        }}
        illustration={<BadgeOverRays tier={result.newLeague.tier} />}
        title={leagueResultTitle(result)}
        actions={
          <Button fullWidth onClick={onContinue}>
            Continue
          </Button>
        }
      />
      {open && result.outcome === "promoted" && <Confetti variant="cannons" />}
    </>
  );
}

function BadgeOverRays({ tier }: { tier: number }) {
  return (
    <div className="relative grid size-44 place-items-center">
      <span
        aria-hidden="true"
        className="absolute inset-0 animate-[rays_8s_linear_infinite] rounded-full bg-[repeating-conic-gradient(rgb(255_200_0/0.3)_0deg_12deg,transparent_12deg_30deg)] [mask-image:radial-gradient(circle,#000_30%,transparent_70%)]"
      />
      <motion.span
        className="relative"
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.15, duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
      >
        <LeagueBadge tier={tier} size={120} />
      </motion.span>
    </div>
  );
}

/**
 * Shows the learner's unacknowledged league result once, and acknowledges it on CONTINUE (the modal closes at
 * once; the server records it). Drop it into any page that should greet the learner with it.
 */
export function PendingLeagueResultModal() {
  const pending = useMe().data?.pendingLeagueResult ?? null;
  const ack = useAckLeagueResult();
  // The acknowledged result is cleared from `me` straight away; keep showing it while the modal fades out.
  const [shown, setShown] = useState(pending);
  if (pending !== null && pending.membershipId !== shown?.membershipId) setShown(pending);
  return (
    <LeagueResultModal
      result={shown}
      open={pending !== null}
      onContinue={() => {
        if (pending) ack.mutate(pending.membershipId);
      }}
    />
  );
}
