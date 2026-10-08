import { Skeleton, SkeletonGroup } from "@/components/ui";

const ROWS = [1, 2, 3, 4] as const;

/** The shop's shape while it loads: the title and balance, then item rows of picture, text and button. */
export function ShopSkeleton() {
  return (
    <SkeletonGroup label="Loading the shop" className="mx-auto w-full max-w-[592px] px-4 pt-6 pb-12 lg:px-0">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-24 rounded-full" />
        <Skeleton className="h-7 w-20 rounded-full" />
      </div>
      <Skeleton className="mt-8 mb-2 h-7 w-28 rounded-full" />
      {ROWS.map((row) => (
        <div key={row} className="grid grid-cols-[64px_1fr] items-center gap-4 border-t-2 border-line py-6 min-[401px]:grid-cols-[96px_1fr_auto] min-[401px]:gap-6">
          <Skeleton className="size-16 rounded-lg min-[401px]:size-24" />
          <div>
            <Skeleton className="h-5 w-36 rounded-full" />
            <Skeleton className="mt-3 h-4 w-full rounded-full" />
            <Skeleton className="mt-2 h-4 w-2/3 rounded-full" />
          </div>
          <Skeleton className="hidden h-[50px] w-[120px] rounded-md min-[401px]:block" />
        </div>
      ))}
    </SkeletonGroup>
  );
}
