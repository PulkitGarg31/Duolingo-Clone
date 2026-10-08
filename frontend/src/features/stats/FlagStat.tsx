import { FlagIcon } from "@/components/icons";
import { CourseMenu } from "@/features/shell/CourseMenu";
import type { CourseBrief } from "@/lib/api/types";
import { StatPopover, type StatPlacement } from "./StatPopover";

/** The current course's flag, which opens the course menu. */
export function FlagStat({ placement, course }: { placement: StatPlacement; course: CourseBrief }) {
  return (
    <StatPopover
      placement={placement}
      title="My courses"
      width={320}
      button={{ "aria-label": `${course.title} course`, icon: <FlagIcon code={course.flagKey} size={32} /> }}
    >
      {(close) => <CourseMenu currentCourseId={course.id} onClose={close} />}
    </StatPopover>
  );
}
