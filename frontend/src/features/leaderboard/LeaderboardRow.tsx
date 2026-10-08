"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { MedalIcon, type MedalRank } from "@/components/icons/MedalIcon";
import { Avatar, CountUp } from "@/components/ui";
import type { LeagueRowOut, LeagueZone } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatTotal } from "@/lib/format";
import { ROW_LAYOUT_TRANSITION } from "./rowMotion";

/** Ranks that move up are green, ranks that drop are red. */
const RANK_COLORS: Record<LeagueZone, string> = {
  promotion: "text-(--c-lb-up-fg)",
  safe: "text-fg-2",
  demotion: "text-(--c-lb-down-fg)",
};

/** The learner's own row: grey in the safe zone, green or red (with matching text) inside a zone. */
const MY_ROW_COLORS: Record<LeagueZone, string> = {
  promotion: "bg-(--c-lb-up-bg) text-(--c-lb-up-fg)",
  safe: "bg-(--c-lb-me) text-fg",
  demotion: "bg-(--c-lb-down-bg) text-(--c-lb-down-fg)",
};

const xpLabel = (xp: number) => `${formatTotal(xp)} XP`;

function isMedalRank(rank: number): rank is MedalRank {
  return rank >= 1 && rank <= 3;
}

/** A medal for the top three, the rank number in its zone's colour below that. */
function RankCell({ rank, zone }: { rank: number; zone: LeagueZone }) {
  return (
    <span className={cn("grid w-[41px] shrink-0 place-items-center text-[17px] leading-[25px] font-extrabold", RANK_COLORS[zone])}>
      {isMedalRank(rank) ? (
        <MedalIcon rank={rank} size={41} title={`Rank ${rank}`} />
      ) : (
        <span>
          <span className="sr-only">Rank </span>
          {rank}
        </span>
      )}
    </span>
  );
}

/**
 * One learner on the board, linking to their profile. When a refresh changes the order the row glides to its new
 * rank and its XP counts up.
 */
export function LeaderboardRow({ row }: { row: LeagueRowOut }) {
  const zoneTinted = row.isMe && row.zone !== "safe";
  return (
    <motion.li layout="position" transition={ROW_LAYOUT_TRANSITION}>
      <Link
        href={row.isMe ? "/profile" : `/profile/${row.userId}`}
        className={cn(
          "flex min-h-16 items-center py-2 pr-6 pl-4 md:rounded-lg",
          "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus",
          row.isMe ? MY_ROW_COLORS[row.zone] : "text-fg hover:bg-subtle",
        )}
      >
        <RankCell rank={row.rank} zone={row.zone} />
        <Avatar name={row.displayName} color={row.avatarColor} size={48} className="mr-7 ml-3" />
        <span className="min-w-0 flex-1 truncate text-[17px] leading-6 font-extrabold md:text-[19px]">{row.displayName}</span>
        <CountUp
          value={row.xp}
          from={row.xp}
          format={xpLabel}
          className={cn("mr-2.5 ml-3 shrink-0 text-body", !zoneTinted && "text-fg-2")}
        />
      </Link>
    </motion.li>
  );
}
