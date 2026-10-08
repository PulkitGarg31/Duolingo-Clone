import { Skeleton } from "@/components/ui";

/** A rail card's outline with a title bar and two lines, while its data loads. */
export function RailCardSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-3 rounded-lg border-2 border-line p-4">
      <Skeleton className="h-5 w-[120px] rounded-full" />
      <Skeleton className="mt-2 h-4 w-full rounded-full" />
      <Skeleton className="h-4 w-full rounded-full" />
    </div>
  );
}
