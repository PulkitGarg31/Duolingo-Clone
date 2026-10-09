import type { ReactNode } from "react";
import { Divider } from "@/components/ui";
import type { CourseBrief, ProfileOut } from "@/lib/api/types";
import { AchievementList } from "./AchievementList";
import { ProfileHeader } from "./ProfileHeader";
import { StatGrid } from "./StatGrid";

interface ProfileViewProps {
  profile: ProfileOut;
  /** The course whose flag shows under "Courses". */
  course: CourseBrief;
  /** The learner's XP chart and streak calendar, between the statistics and the achievements. */
  activity?: ReactNode;
  /** The signed-in learner's email, shown on their own profile. */
  email?: string | null;
  /** Under the header: the guest card on the demo learner's own profile, where the right rail is hidden. */
  notice?: ReactNode;
}

/** A profile page: the learner's own, or anyone's from the leaderboard, bots included. */
export function ProfileView({ profile, course, activity, email, notice }: ProfileViewProps) {
  return (
    <div className="mx-auto w-full max-w-[592px] pb-16 lg:pt-6">
      <ProfileHeader user={profile.user} course={course} email={email} />
      <div className="px-4 lg:px-0">
        {notice}
        <Divider className="my-6" />
        <div className="space-y-10">
          <StatGrid stats={profile.stats} />
          {activity}
          <AchievementList achievements={profile.achievements} />
        </div>
      </div>
    </div>
  );
}
