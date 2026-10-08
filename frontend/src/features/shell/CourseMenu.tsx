"use client";

import type { ReactNode } from "react";
import { CheckIcon, FlagIcon, PlusIcon } from "@/components/icons";
import { ComingSoonPill, Divider, Skeleton } from "@/components/ui";
import type { CourseBrief } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { useCourses } from "@/lib/queries/hooks";
import { useComingSoon } from "./ComingSoon";

interface CourseMenuProps {
  currentCourseId: number;
  onClose: () => void;
}

/** The course switcher behind the flag. Only Spanish is published; the other courses are Coming soon. */
export function CourseMenu({ currentCourseId, onClose }: CourseMenuProps) {
  const courses = useCourses();
  const showComingSoon = useComingSoon();

  function comingSoon(feature: string) {
    onClose();
    showComingSoon(feature);
  }

  return (
    <CourseMenuView
      courses={courses.data?.items ?? null}
      currentCourseId={currentCourseId}
      onCurrent={onClose}
      onComingSoon={comingSoon}
    />
  );
}

interface CourseMenuViewProps {
  /** Null while the list loads. */
  courses: readonly CourseBrief[] | null;
  currentCourseId: number;
  onCurrent: () => void;
  onComingSoon: (feature: string) => void;
}

export function CourseMenuView({ courses, currentCourseId, onCurrent, onComingSoon }: CourseMenuViewProps) {
  return (
    <div className="flex flex-col gap-2">
      <h2 className="mb-2 text-heading text-fg">My courses</h2>
      {courses === null ? (
        <Skeleton className="h-12 w-full rounded-md" />
      ) : (
        <ul className="flex flex-col">
          {courses.map((course) => (
            <li key={course.id}>
              {course.isPublished ? (
                <CourseRow flag={course.flagKey} label={course.title} onClick={onCurrent}>
                  {course.id === currentCourseId && <CheckIcon size={20} className="text-owl" title="Current course" />}
                </CourseRow>
              ) : (
                <CourseRow flag={course.flagKey} label={course.title} muted onClick={() => onComingSoon(`the ${course.title} course`)}>
                  <ComingSoonPill />
                </CourseRow>
              )}
            </li>
          ))}
        </ul>
      )}
      <Divider />
      <CourseRow icon={<PlusIcon size={24} className="text-fg-3" />} label="Add a new course" muted onClick={() => onComingSoon("more courses")} />
    </div>
  );
}

interface CourseRowProps {
  flag?: string;
  icon?: ReactNode;
  label: string;
  muted?: boolean;
  onClick: () => void;
  children?: ReactNode;
}

function CourseRow({ flag, icon, label, muted = false, onClick, children }: CourseRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-14 w-full cursor-pointer items-center gap-4 rounded-md px-2 text-left hover:bg-subtle focus-visible:outline-2 focus-visible:outline-focus"
    >
      {flag ? <FlagIcon code={flag} size={32} /> : <span className="grid w-8 place-items-center">{icon}</span>}
      <span className={cn("flex-1 text-[17px] leading-5 font-extrabold", muted ? "text-fg-3" : "text-fg")}>{label}</span>
      {children}
    </button>
  );
}
