import { Skeleton, SkeletonGroup } from "@/components/ui";

const ROWS = [0, 1, 2, 3, 4] as const;

/** The settings page while it loads: the title, a section header and its switch rows. */
export function SettingsSkeleton() {
  return (
    <SkeletonGroup label="Loading settings" className="mx-auto w-full max-w-[592px] px-4 pt-4 lg:px-0 lg:pt-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-44 rounded-md" />
        <Skeleton className="hidden h-[50px] w-[180px] rounded-md lg:block" />
      </div>
      <Skeleton className="mt-10 h-7 w-52 rounded-md" />
      {ROWS.map((row) => (
        <div key={row} className="flex min-h-[78px] items-center justify-between border-b-2 border-line py-4">
          <Skeleton className="h-5 w-44 rounded-md" />
          <Skeleton className="h-6 w-[57px] rounded-full" />
        </div>
      ))}
    </SkeletonGroup>
  );
}
