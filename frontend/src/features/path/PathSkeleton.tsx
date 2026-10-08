import { Skeleton, SkeletonGroup } from "@/components/ui";
import { nodeMarginTop, nodeOffsetX } from "./pathLayout";

const PLACEHOLDER_NODES = 6;
/** The decoration placeholder sits where the first unit's owl would, beside the third node. */
const DECOR_NODE_INDEX = 2;

/** The path's shape while it loads: the banner, six node ovals in the zig-zag and the mascot's spot. No fake text. */
export function PathSkeleton() {
  const offsets = Array.from({ length: PLACEHOLDER_NODES }, (_, index) => nodeOffsetX(index, 0, false));
  return (
    <SkeletonGroup label="Loading your path">
      <div className="xl:pt-6">
        <Skeleton className="h-[82px] w-full md:rounded-md" />
      </div>
      <ol className="flex flex-col items-center overflow-x-clip pb-6">
        {offsets.map((x, index) => (
          <li
            key={index}
            className="relative"
            style={{ left: x, marginTop: nodeMarginTop(offsets[index - 1] ?? 0, x, index === 0, false) }}
          >
            <Skeleton className="h-[57px] w-[70px] rounded-[50%]" />
            <div className="h-2" />
            {index === DECOR_NODE_INDEX && (
              // Where the first unit's owl stands: 133 px right of the centre line, 107 px on phones.
              <Skeleton
                className="absolute top-[28.5px] left-1/2 h-[180px] w-[140px] rounded-[24px] [--decor-x:107px] md:[--decor-x:133px]"
                style={{ translate: `calc(var(--decor-x) - ${x}px - 50%) -50%` }}
              />
            )}
          </li>
        ))}
      </ol>
    </SkeletonGroup>
  );
}
