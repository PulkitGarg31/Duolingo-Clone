"use client";

import type { ReactNode } from "react";
import { ClockIcon, LeagueBadge } from "@/components/icons";
import { Owl } from "@/components/mascot";
import type { MeLeague } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatCountdown, pluralize } from "@/lib/format";
import { useCountdown } from "@/lib/time/serverClock";
import { leagueStatusLine, type LeagueStatusTone } from "./leagueStatus";
import { RailCard } from "./RailCard";

const VIEW_LEAGUE = { label: "View league", href: "/leaderboard" };

const TONE_CLASSES: Record<LeagueStatusTone, string> = {
  top: "text-streak",
  up: "text-correct-fg",
  down: "text-wrong-fg",
  neutral: "text-fg-2",
};

/** The learner's league: locked until 10 sessions, an invitation before this week's first lesson, then the standing. */
export function LeagueCard({ league }: { league: MeLeague }) {
  if (!league.unlocked) {
    return (
      <RailCard title="Unlock Leaderboards!">
        <CardRow art={<LeagueBadge tier={1} locked size={56} />}>
          <p className="text-body text-fg-2">
            Complete {pluralize(league.lessonsToUnlock, "more lesson")} to start competing
          </p>
        </CardRow>
      </RailCard>
    );
  }

  const title = `${league.name} League`;
  const status = leagueStatusLine(league);
  if (league.rank === null || status === null) {
    return (
      <RailCard title={title} link={VIEW_LEAGUE}>
        <CardRow art={<Owl pose="idle" size={56} className="grayscale" />}>
          <p className="text-body text-fg-2">
            Complete a lesson to join this week&apos;s leaderboard and compete against other learners
          </p>
        </CardRow>
      </RailCard>
    );
  }

  return (
    <RailCard title={title} link={VIEW_LEAGUE}>
      <CardRow art={<LeagueBadge tier={league.tier} size={56} />}>
        <p className="text-[17px] leading-5 font-extrabold text-fg">You&apos;re ranked #{league.rank}</p>
        <p className={cn("mt-1 text-[15px] leading-5 font-extrabold", TONE_CLASSES[status.tone])}>{status.text}</p>
        <WeekCountdown endsAt={league.weekEndsAt} />
      </CardRow>
    </RailCard>
  );
}

function CardRow({ art, children }: { art: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-center gap-4">
      <div className="shrink-0">{art}</div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** Time left in the league week, e.g. "4 days". */
function WeekCountdown({ endsAt }: { endsAt: string }) {
  const remaining = useCountdown(endsAt);
  return (
    <p className="mt-1 flex items-center gap-1.5 text-[15px] leading-5 font-extrabold text-streak">
      <ClockIcon size={16} />
      {formatCountdown(remaining)}
    </p>
  );
}
