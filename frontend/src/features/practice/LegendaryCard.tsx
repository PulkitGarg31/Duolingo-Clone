import { TrophyGlyph } from "@/components/icons/TrophyGlyph";
import { Card } from "@/components/ui";
import type { PathNodeOut } from "@/lib/api/types";
import { GlyphTile } from "./GlyphTile";
import { LegendarySkillRow } from "./LegendarySkillRow";
import type { LegendarySkill } from "./practiceOptions";

interface LegendaryCardProps {
  skills: readonly LegendarySkill[];
  gems: number;
  onLegendary: (node: PathNodeOut) => void;
}

/** Legendary challenges: every finished skill, each with its LEGENDARY button, or how to unlock the first. */
export function LegendaryCard({ skills, gems, onLegendary }: LegendaryCardProps) {
  return (
    <Card padding="lg">
      <div className="grid grid-cols-[64px_1fr] items-center gap-4">
        <GlyphTile color="gold">
          <TrophyGlyph size={36} />
        </GlyphTile>
        <div className="min-w-0">
          <h2 className="text-card-title text-fg">Legendary</h2>
          <p className="mt-1 text-body text-fg-2">
            {skills.length > 0 ? "Prove your proficiency with Legendary" : "Complete a level to unlock Legendary"}
          </p>
        </div>
      </div>
      {skills.length > 0 && (
        <ul aria-label="Finished skills" className="mt-4">
          {skills.map((skill) => (
            <LegendarySkillRow key={skill.node.id} skill={skill} gems={gems} onLegendary={() => onLegendary(skill.node)} />
          ))}
        </ul>
      )}
    </Card>
  );
}
