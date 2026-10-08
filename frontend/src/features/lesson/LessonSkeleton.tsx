import { Skeleton, SkeletonGroup } from "@/components/ui/Skeleton";

/** The player's shape while the session loads: the header track, an instruction line and three choices. */
export function LessonSkeleton() {
  return (
    <SkeletonGroup label="Loading lesson" className="min-h-dvh bg-page">
      <div className="px-4 pt-3 pb-[clamp(4px,1.5vh,24px)] md:pt-4 md:pb-6">
        <div className="mx-auto flex min-h-10 max-w-[1000px] items-center gap-4">
          <Skeleton className="size-6 rounded-md" />
          <Skeleton className="h-4 flex-1 rounded-full" />
          <Skeleton className="h-7 w-12 rounded-md" />
        </div>
      </div>
      {/* The gutter sits outside the 600 px column, as in the player, so the blocks line up with the exercise. */}
      <div className="px-4 pt-6 md:pt-16">
        <div className="mx-auto grid w-full max-w-[600px] gap-4 md:gap-6">
          <Skeleton className="h-8 w-3/5 rounded-md" />
          <div className="grid grid-cols-3 gap-3 sm:gap-4">
            {[0, 1, 2].map((card) => (
              <Skeleton key={card} className="aspect-[3/4] rounded-md" />
            ))}
          </div>
        </div>
      </div>
    </SkeletonGroup>
  );
}
