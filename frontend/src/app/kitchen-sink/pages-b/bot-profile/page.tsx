"use client";

import { ProfileView } from "@/features/profile/ProfileView";
import { botProfile, me } from "../fixtures";

/** A leaderboard bot's profile: no XP chart, no calendar, a FOLLOW button. */
export default function BotProfilePreview() {
  return <ProfileView profile={botProfile} course={me.course} />;
}
