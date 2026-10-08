import { Skeleton, SkeletonGroup } from "@/components/ui";

const STAT_CARDS = [0, 1, 2, 3] as const;
const ACHIEVEMENT_ROWS = [0, 1, 2] as const;

/** The profile's shape while it loads: avatar panel, name lines, the statistics grid and achievement rows. */
export function ProfileSkeleton() {
  return (
    <SkeletonGroup label="Loading profile" className="mx-auto w-full max-w-[592px] lg:pt-6">
      <Skeleton className="h-[160px] lg:h-[200px] lg:rounded-lg" />
      <div className="px-4 lg:px-0">
        <Skeleton className="mt-6 h-7 w-48 rounded-md" />
        <Skeleton className="mt-3 h-5 w-64 max-w-full rounded-md" />
        <Skeleton className="mt-6 h-[52px] rounded-md" />
        <Skeleton className="mt-12 h-7 w-36 rounded-md" />
        <div className="mt-4 grid grid-cols-2 gap-3 md:gap-4">
          {STAT_CARDS.map((card) => (
            <Skeleton key={card} className="h-[76px] rounded-lg" />
          ))}
        </div>
        <Skeleton className="mt-10 h-7 w-44 rounded-md" />
        <div className="mt-4 space-y-3">
          {ACHIEVEMENT_ROWS.map((row) => (
            <Skeleton key={row} className="h-[104px] rounded-lg" />
          ))}
        </div>
      </div>
    </SkeletonGroup>
  );
}
