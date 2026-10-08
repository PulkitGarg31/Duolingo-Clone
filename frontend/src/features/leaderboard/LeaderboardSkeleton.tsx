import { Skeleton, SkeletonGroup } from "@/components/ui";

/** Five badge outlines with the current one in the middle, like the real carousel. */
const BADGES = [false, false, true, false, false] as const;
const ROWS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

/** The leaderboard's shape while it loads: the header, then eight rows of avatar, name and XP. */
export function LeaderboardSkeleton() {
  return (
    <SkeletonGroup label="Loading the leaderboard" className="mx-auto w-full max-w-[592px]">
      <div className="flex flex-col items-center border-b-2 border-line px-4 pt-6 pb-5">
        <div className="flex h-[91px] items-center gap-7">
          {BADGES.map((current, index) => (
            <Skeleton key={index} className={current ? "h-[89px] w-20 rounded-[22px]" : "h-[58px] w-[52px] rounded-[14px]"} />
          ))}
        </div>
        <Skeleton className="mt-6 h-7 w-44 rounded-full" />
        <Skeleton className="mt-3 h-5 w-64 max-w-full rounded-full" />
        <Skeleton className="mt-3 h-5 w-20 rounded-full" />
      </div>
      <div className="pt-2">
        {ROWS.map((row) => (
          <div key={row} className="flex min-h-16 items-center py-2 pr-6 pl-4">
            <span className="w-[41px] shrink-0" />
            <Skeleton className="mr-7 ml-3 size-12 shrink-0 rounded-full" />
            <Skeleton className="h-[18px] w-40 rounded-full" />
            <Skeleton className="mr-2.5 ml-auto h-[18px] w-[60px] shrink-0 rounded-full" />
          </div>
        ))}
      </div>
    </SkeletonGroup>
  );
}
