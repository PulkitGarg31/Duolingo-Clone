import type { Metadata } from "next";
import { QuestsPage } from "@/features/quests/QuestsPage";

export const metadata: Metadata = { title: "Quests" };

export default function QuestsRoute() {
  return <QuestsPage />;
}
