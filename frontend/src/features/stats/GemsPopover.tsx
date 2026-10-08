import { GemPileIcon } from "@/components/icons";
import { ButtonLink } from "@/components/ui";
import { formatTotal } from "@/lib/format";

/** The gem balance with a way to the shop. */
export function GemsPopover({ gems, onClose }: { gems: number; onClose: () => void }) {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-heading text-fg">Gems</h2>
      <div className="flex items-center gap-4">
        <GemPileIcon size={72} />
        <p className="text-body text-fg">You have {formatTotal(gems)} gems</p>
      </div>
      <ButtonLink href="/shop" variant="outline" fullWidth onClick={onClose}>
        Go to shop
      </ButtonLink>
    </div>
  );
}
