import type { ReactNode } from "react";
import { BoltIcon, HeartIcon, LegendaryTrophyIcon, LightbulbIcon } from "@/components/icons";
import { Button, Modal } from "@/components/ui";
import type { PathNodeOut } from "@/lib/api/types";

interface LegendaryIntroModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The completed node to take to Legendary; kept while the modal closes. */
  node: PathNodeOut | null;
  gems: number;
  starting: boolean;
  onStart: () => void;
}

/** The rules of a Legendary run, shown before the gems are charged: the server charges when the session starts. */
export function LegendaryIntroModal({ open, onOpenChange, node, gems, starting, onStart }: LegendaryIntroModalProps) {
  const price = node?.actions.legendaryPriceGems ?? 0;
  const xp = node?.actions.legendaryXp ?? 0;
  const affordable = gems >= price;
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      illustration={<LegendaryTrophyIcon size={140} />}
      title="Prove you're a legend"
      description="Complete this extra-hard challenge and level up to Legendary!"
      actions={
        <>
          <Button variant="gold" fullWidth disabled={!affordable} loading={starting} onClick={onStart}>
            Start challenge
          </Button>
          <Button variant="ghost" fullWidth onClick={() => onOpenChange(false)}>
            Not now
          </Button>
        </>
      }
    >
      <ul className="mx-auto flex w-fit flex-col gap-3">
        <Rule icon={<LightbulbIcon size={32} />}>No hints</Rule>
        <Rule icon={<HeartIcon size={32} />}>3 mistakes and it&apos;s over</Rule>
        <Rule icon={<BoltIcon size={32} />}>Earn {xp} XP</Rule>
      </ul>
      <p className="mt-5 text-center text-[13px] leading-4 font-semibold text-fg-3">
        {affordable ? `Uses ${price} gems` : "Not enough gems"}
      </p>
    </Modal>
  );
}

function Rule({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <li className="flex items-center gap-4 text-left text-[17px] leading-6 font-semibold text-fg">
      {icon}
      <span>{children}</span>
    </li>
  );
}
