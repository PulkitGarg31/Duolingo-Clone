import { Skeleton, SkeletonGroup } from "@/components/ui";

const PHRASES = [0, 1, 2, 3] as const;

/** The guidebook while it loads: the back link, the unit banner and key-phrase cards. */
export function GuidebookSkeleton() {
  return (
    <SkeletonGroup label="Loading guidebook" className="mx-auto w-full max-w-[600px] px-4 pt-4 lg:px-0 lg:pt-6">
      <Skeleton className="h-[18px] w-20 rounded-md" />
      <Skeleton className="mt-9 h-[142px] rounded-lg" />
      <Skeleton className="mt-10 h-[18px] w-28 rounded-md" />
      <div className="mt-4 space-y-3">
        {PHRASES.map((phrase) => (
          <Skeleton key={phrase} className="h-[86px] rounded-lg" />
        ))}
      </div>
    </SkeletonGroup>
  );
}
