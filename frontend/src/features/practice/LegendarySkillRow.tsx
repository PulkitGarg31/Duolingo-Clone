import { StarGlyph } from "@/components/icons/StarGlyph";
import { TrophyGlyph } from "@/components/icons/TrophyGlyph";
import { Button } from "@/components/ui";
import { GlyphTile } from "./GlyphTile";
import type { LegendarySkill } from "./practiceOptions";

interface LegendarySkillRowProps {
  skill: LegendarySkill;
  gems: number;
  onLegendary: () => void;
}

/**
 * A finished skill: its LEGENDARY button (off, with "Not enough gems", when the learner cannot pay the fee), or
 * a gold coin for a skill that already is legendary.
 */
export function LegendarySkillRow({ skill: { node, unit }, gems, onLegendary }: LegendarySkillRowProps) {
  const legendary = node.state === "legendary";
  const affordable = gems >= node.actions.legendaryPriceGems;
  return (
    <li className="flex items-center gap-4 border-t-2 border-line py-3 last:pb-0">
      <GlyphTile color={legendary ? "gold" : unit.color} shape="coin">
        {legendary ? <TrophyGlyph size={22} /> : <StarGlyph size={22} />}
      </GlyphTile>
      <span className="min-w-0 flex-1">
        <span className="block text-body font-extrabold text-fg">{node.title}</span>
        <span className="block text-small text-fg-2">Unit {unit.number}</span>
      </span>
      {legendary ? (
        <span className="text-label text-(--unit-gold-dark) uppercase">Legendary</span>
      ) : (
        <span className="flex flex-col items-center gap-1">
          <Button variant="gold" size="sm" disabled={!affordable} onClick={onLegendary}>
            Legendary
          </Button>
          {!affordable && <span className="text-[13px] leading-4 font-extrabold text-fg-3">Not enough gems</span>}
        </span>
      )}
    </li>
  );
}
