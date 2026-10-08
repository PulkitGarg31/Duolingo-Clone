import { GemIcon } from "@/components/icons/GemIcon";
import { CountUp } from "@/components/ui";
import { formatTotal } from "@/lib/format";

/** "Shop" and the gem balance, which rolls down to the new amount after a purchase. */
export function ShopHeader({ gems }: { gems: number }) {
  return (
    <header className="flex items-center justify-between gap-4">
      <h1 className="text-[24px] leading-[30px] font-extrabold text-fg-strong md:text-title-lg">Shop</h1>
      <p className="flex items-center gap-2 text-stat text-gem">
        <GemIcon size={28} variant={gems > 0 ? "active" : "inactive"} />
        <CountUp value={gems} from={gems} format={formatTotal} />
        <span className="sr-only">gems</span>
      </p>
    </header>
  );
}
