import { Skeleton, SkeletonGroup } from "@/components/ui";

const ROWS = [1, 2, 3] as const;

/** The quests page's shape while it loads: the header card, then the three quest rows. */
export function QuestsSkeleton() {
  return (
    <SkeletonGroup label="Loading quests" className="mx-auto w-full max-w-[592px] px-4 pt-4 pb-12 lg:px-0 lg:pt-6">
      <Skeleton className="mt-6 h-[190px] rounded-lg" />
      <Skeleton className="mt-10 h-7 w-40 rounded-full" />
      <Skeleton className="mt-3 h-5 w-full max-w-[420px] rounded-full" />
      <div className="mt-4 rounded-lg border-2 border-line">
        {ROWS.map((row) => (
          <div key={row} className="grid grid-cols-[48px_1fr] items-center gap-4 border-t-2 border-line px-5 py-4 first:border-t-0">
            <Skeleton className="size-12 rounded-full" />
            <div>
              <Skeleton className="h-5 w-40 rounded-full" />
              <Skeleton className="mt-2 mr-5 h-[18px] rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </SkeletonGroup>
  );
}
