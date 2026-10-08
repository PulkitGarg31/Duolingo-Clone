import { Skeleton } from "@/components/ui";
import { cn } from "@/lib/cn";

const PILLS = ["flag", "streak", "xp", "gems", "hearts"] as const;

/** Five stat-shaped pills while `me` loads. */
export function StatsBarSkeleton({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn("flex items-center justify-between", className)}>
      {PILLS.map((pill) => (
        <Skeleton key={pill} className="h-7 w-16 rounded-[14px] max-[25rem]:w-12" />
      ))}
    </div>
  );
}
