import type { Metadata } from "next";
import { ComingSoonPage } from "@/components/ui";

export const metadata: Metadata = { title: "Friends" };

export default function FriendsRoute() {
  return <ComingSoonPage feature="the friends list" />;
}
