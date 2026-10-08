import type { Metadata } from "next";
import { ProfileNotFound } from "@/features/profile/ProfileNotFound";
import { ProfilePage } from "@/features/profile/ProfilePage";

export const metadata: Metadata = { title: "Profile" };

/**
 * Leaderboard rows link here with a user id. Anything but a positive whole number cannot be a learner, so it
 * gets the not-found view straight away; an id the API does not know reaches the same view from the page.
 */
export default async function UserProfilePage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  if (!/^[1-9]\d{0,8}$/.test(userId)) return <ProfileNotFound />;
  return <ProfilePage userId={Number(userId)} />;
}
