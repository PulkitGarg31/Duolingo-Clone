import type { ReactNode } from "react";
import { BoltIcon, FlameIcon, LeagueBadge, MedalIcon } from "@/components/icons";
import type { ProfileStats } from "@/lib/api/types";
import { formatTotal } from "@/lib/format";

const ICON_SIZE = 28;

/** The "Statistics" grid: four bordered cards, two per row at every width. */
export function StatGrid({ stats }: { stats: ProfileStats }) {
  const { currentStreak, totalXp, league, topThreeFinishes } = stats;
  return (
    <section aria-labelledby="profile-stats-title">
      <h2 id="profile-stats-title" className="text-heading text-fg-strong">
        Statistics
      </h2>
      <ul className="mt-4 grid grid-cols-2 gap-3 md:gap-4">
        <StatCard
          icon={<FlameIcon variant={currentStreak > 0 ? "active" : "inactive"} size={ICON_SIZE} />}
          value={currentStreak}
          label="Day streak"
        />
        <StatCard icon={<BoltIcon size={ICON_SIZE} />} value={formatTotal(totalXp)} label="Total XP" />
        <StatCard
          icon={<LeagueBadge tier={league?.tier ?? 1} locked={!league} size={ICON_SIZE} />}
          value={league?.name ?? "None"}
          label="Current league"
        />
        <StatCard icon={<MedalIcon rank={1} size={ICON_SIZE} />} value={topThreeFinishes} label="Top 3 finishes" />
      </ul>
    </section>
  );
}

interface StatCardProps {
  icon: ReactNode;
  value: ReactNode;
  label: string;
}

function StatCard({ icon, value, label }: StatCardProps) {
  return (
    <li className="grid grid-cols-[28px_1fr] gap-x-3 rounded-lg border-2 border-line px-4 py-3">
      <span className="row-span-2 flex justify-center pt-0.5">{icon}</span>
      <span className="truncate text-[20px] leading-6 font-extrabold text-fg-strong tabular-nums">{value}</span>
      <span className="text-small text-fg-2">{label}</span>
    </li>
  );
}
