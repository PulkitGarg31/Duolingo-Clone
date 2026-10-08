import { Skeleton, SkeletonGroup } from "@/components/ui";

const CARDS = [1, 2, 3, 4] as const;

/** The practice hub's shape while it loads: the title, then a column of cards. */
export function PracticeSkeleton() {
  return (
    <SkeletonGroup label="Loading practice" className="mx-auto w-full max-w-[592px] px-4 pt-6 pb-12 lg:px-0">
      <Skeleton className="h-8 w-32 rounded-full" />
      <Skeleton className="mt-3 h-5 w-72 max-w-full rounded-full" />
      <div className="mt-6 grid gap-4">
        {CARDS.map((card) => (
          <div key={card} className="grid grid-cols-[64px_1fr] items-center gap-4 rounded-lg border-2 border-line p-5">
            <Skeleton className="size-16 rounded-[18px]" />
            <div>
              <Skeleton className="h-5 w-48 max-w-full rounded-full" />
              <Skeleton className="mt-3 h-4 w-32 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </SkeletonGroup>
  );
}
