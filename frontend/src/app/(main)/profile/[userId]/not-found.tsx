import { ProfileNotFound } from "@/features/profile/ProfileNotFound";

/** An unknown or malformed user id: the app frame stays, with the lost owl in the page. */
export default function UserProfileNotFound() {
  return <ProfileNotFound />;
}
