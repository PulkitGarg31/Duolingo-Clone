import type { Metadata } from "next";
import { ProfilePage } from "@/features/profile/ProfilePage";

export const metadata: Metadata = { title: "Profile" };

export default function MyProfilePage() {
  return <ProfilePage userId="me" />;
}
