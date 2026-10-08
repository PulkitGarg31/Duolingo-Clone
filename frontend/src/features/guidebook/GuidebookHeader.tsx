import { BookGlyph } from "@/components/icons";
import { unitColorVariables } from "@/features/path/unitColors";
import type { GuidebookOut } from "@/lib/api/types";

/** The unit's banner: "UNIT n", its title and what the guidebook holds, on the unit's own colour. */
export function GuidebookHeader({ unit }: { unit: GuidebookOut["unit"] }) {
  return (
    <header
      style={unitColorVariables(unit.color)}
      className="mt-6 flex items-center gap-4 rounded-lg bg-(--unit) p-5 text-on-color-fixed shadow-[0_4px_0_var(--unit-lip)] md:p-6"
    >
      <div className="min-w-0 flex-1">
        <p className="text-overline uppercase opacity-80">Unit {unit.number}</p>
        <h1 className="mt-1 text-[24px] leading-[30px] font-extrabold md:text-title-lg">{unit.title}</h1>
        <p className="mt-2 text-body opacity-90">Learn grammar tips and see key phrases for this unit</p>
      </div>
      <span aria-hidden="true" className="hidden size-16 shrink-0 place-items-center rounded-full bg-on-color-fixed/20 sm:grid">
        <BookGlyph size={34} />
      </span>
    </header>
  );
}
