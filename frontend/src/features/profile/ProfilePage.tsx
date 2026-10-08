"use client";

import { notFound } from "next/navigation";
import { isApiError } from "@/lib/api/errors";
import { useMe, useProfile } from "@/lib/queries/hooks";
import { LearnerActivity } from "./LearnerActivity";
import { ProfileSkeleton } from "./ProfileSkeleton";
import { ProfileView } from "./ProfileView";

/**
 * `/profile` (userId "me") and `/profile/[userId]`. An unknown user is a 404; any other failure goes to the
 * route's error boundary, whose TRY AGAIN remounts this page and refetches.
 */
export function ProfilePage({ userId }: { userId: number | "me" }) {
  const profile = useProfile(userId);
  const me = useMe();

  if (profile.data && me.data) {
    const { user } = profile.data;
    return (
      <ProfileView
        profile={profile.data}
        course={me.data.course}
        activity={user.isMe ? <LearnerActivity me={me.data} joinedAt={user.joinedAt} /> : undefined}
      />
    );
  }

  const error = profile.error ?? me.error;
  if (isApiError(error, "NOT_FOUND")) notFound();
  if (error) throw error;
  return <ProfileSkeleton />;
}
